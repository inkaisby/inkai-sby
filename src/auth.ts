import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { cookies } from "next/headers";
import { authConfig } from "@/auth.config";
import { inkaiFetch } from "@/lib/inkai-api/server";
import {
  getInkaiTokenCookieOptions,
  INKAI_TOKEN_COOKIE,
} from "@/lib/inkai-api/cookies";
import { isMemberLoginBlocked } from "@/lib/security/member-status";
import { clearPresence, markUserLogin } from "@/lib/presence";
import { snapshotFromNextHeaders } from "@/lib/session-audit";
import { loadSessionClaimsFromDb } from "@/lib/session-refresh";
import { LOGIN_ERROR_CODE } from "@/lib/auth/login-errors";
import { prisma } from "@/lib/prisma";

const SESSION_CLAIMS_TTL_MS = 30_000;

function throwLogin(code: string): never {
  const err = new CredentialsSignin();
  err.code = code;
  throw err;
}

declare module "next-auth" {
  interface User {
    roles: string[];
    managedProvinceId?: string | null;
    managedBranchId?: string | null;
    managedDojoId?: string | null;
    memberId?: string | null;
    accessToken?: string;
    photoUrl?: string | null;
  }
  interface Session {
    accessToken?: string;
    user: {
      id: string;
      email: string;
      name: string;
      roles: string[];
      managedProvinceId?: string | null;
      managedBranchId?: string | null;
      managedDojoId?: string | null;
      memberId?: string | null;
      photoUrl?: string | null;
      image?: string | null;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    roles: string[];
    managedProvinceId?: string | null;
    managedBranchId?: string | null;
    managedDojoId?: string | null;
    memberId?: string | null;
    accessToken?: string;
    claimsUpdatedAt?: number;
    photoUrl?: string | null;
  }
}

type BackendUser = {
  id?: string;
  email?: string;
  fullName?: string;
  photoUrl?: string | null;
  roles?: string[];
  managedProvinceId?: string | null;
  managedBranchId?: string | null;
  managedDojoId?: string | null;
  memberId?: string | null;
  member?: { id?: string; status?: string; photoUrl?: string | null };
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger }) {
      if (user) {
        token.roles = user.roles;
        token.managedProvinceId = user.managedProvinceId;
        token.managedBranchId = user.managedBranchId;
        token.managedDojoId = user.managedDojoId;
        token.memberId = user.memberId;
        token.name = user.name;
        token.photoUrl = user.photoUrl ?? null;
        token.claimsUpdatedAt = Date.now();
        return token;
      }

      const userId = token.sub;
      if (!userId) return token;

      const stale =
        trigger === "update" ||
        !token.claimsUpdatedAt ||
        Date.now() - token.claimsUpdatedAt > SESSION_CLAIMS_TTL_MS;

      if (!stale) return token;

      const claims = await loadSessionClaimsFromDb(userId);
      if (claims) {
        token.roles = claims.roles;
        token.managedProvinceId = claims.managedProvinceId;
        token.managedBranchId = claims.managedBranchId;
        token.managedDojoId = claims.managedDojoId;
        token.memberId = claims.memberId;
        if (claims.name) token.name = claims.name;
        token.photoUrl = claims.photoUrl ?? null;
      }
      token.claimsUpdatedAt = Date.now();
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        session.user.name = (token.name as string) || session.user.name;
        session.user.roles = (token.roles as string[]) || [];
        session.user.managedProvinceId = token.managedProvinceId as string | null;
        session.user.managedBranchId = token.managedBranchId as string | null;
        session.user.managedDojoId = token.managedDojoId as string | null;
        session.user.memberId = token.memberId as string | null;
        const photo =
          (token.photoUrl as string | null | undefined) ?? null;
        session.user.photoUrl = photo;
        session.user.image = photo;
      }
      return session;
    },
  },
  events: {
    async signOut(message) {
      const cookieStore = await cookies();
      cookieStore.delete(INKAI_TOKEN_COOKIE);
      const userId =
        message && "token" in message
          ? (message.token?.sub as string | undefined)
          : undefined;
      if (userId) {
        await clearPresence(userId).catch(() => {});
      }
    },
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throwLogin(LOGIN_ERROR_CODE.credentials);
        }

        const identifier = (credentials.email as string).trim();

        let res: Response;
        let data: Record<string, unknown>;
        try {
          ({ res, data } = await inkaiFetch(
            "/v1/auth/login",
            {
              method: "POST",
              body: JSON.stringify({
                identifier,
                password: credentials.password,
              }),
            },
            null,
          ));
        } catch {
          throwLogin(LOGIN_ERROR_CODE.server_error);
        }

        if (res.status >= 500) throwLogin(LOGIN_ERROR_CODE.server_error);
        if (res.status === 429) throwLogin(LOGIN_ERROR_CODE.rate_limited);
        if (res.status === 403) throwLogin(LOGIN_ERROR_CODE.disabled);
        if (!res.ok) throwLogin(LOGIN_ERROR_CODE.credentials);

        const token = typeof data.token === "string" ? data.token : null;
        const payload = data.data as { user?: BackendUser } | undefined;
        const user = payload?.user;
        if (!token || !user?.id || !user.email) {
          throwLogin(LOGIN_ERROR_CODE.server_error);
        }

        const roles = Array.isArray(user.roles) ? user.roles : [];
        const memberId = user.memberId ?? user.member?.id ?? null;
        const memberStatus = user.member?.status;
        if (isMemberLoginBlocked(memberStatus)) {
          throwLogin(LOGIN_ERROR_CODE.blocked);
        }

        const cookieStore = await cookies();
        cookieStore.set(INKAI_TOKEN_COOKIE, token, getInkaiTokenCookieOptions());

        const userId = user.id;
        void snapshotFromNextHeaders()
          .then((snap) => markUserLogin(userId, snap))
          .catch(() => markUserLogin(userId));

        const local = await prisma.user
          .findFirst({
            where: { id: userId, isDeleted: false },
            select: { photoUrl: true, fullName: true },
          })
          .catch(() => null);

        const photoUrl =
          local?.photoUrl ||
          user.photoUrl ||
          user.member?.photoUrl ||
          null;

        return {
          id: userId,
          email: user.email,
          name: local?.fullName || user.fullName || user.email,
          photoUrl,
          roles,
          managedProvinceId: user.managedProvinceId ?? null,
          managedBranchId: user.managedBranchId ?? null,
          managedDojoId: user.managedDojoId ?? null,
          memberId,
        };
      },
    }),
  ],
});
