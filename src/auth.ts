import NextAuth from "next-auth";
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

declare module "next-auth" {
  interface User {
    roles: string[];
    managedProvinceId?: string | null;
    managedBranchId?: string | null;
    managedDojoId?: string | null;
    memberId?: string | null;
    accessToken?: string;
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
  }
}

type BackendUser = {
  id?: string;
  email?: string;
  fullName?: string;
  roles?: string[];
  managedProvinceId?: string | null;
  managedBranchId?: string | null;
  managedDojoId?: string | null;
  memberId?: string | null;
  member?: { id?: string; status?: string };
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
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
        if (!credentials?.email || !credentials?.password) return null;

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
          return null;
        }

        if (!res.ok) return null;

        const token = typeof data.token === "string" ? data.token : null;
        const payload = data.data as { user?: BackendUser } | undefined;
        const user = payload?.user;
        if (!token || !user?.id || !user.email) return null;

        const roles = Array.isArray(user.roles) ? user.roles : [];
        const memberId = user.memberId ?? user.member?.id ?? null;
        const memberStatus = user.member?.status;
        if (isMemberLoginBlocked(memberStatus)) {
          return null;
        }

        const cookieStore = await cookies();
        cookieStore.set(INKAI_TOKEN_COOKIE, token, getInkaiTokenCookieOptions());

        const userId = user.id;
        // Non-blocking: gagal presence tidak boleh gagalkan login.
        void snapshotFromNextHeaders()
          .then((snap) => markUserLogin(userId, snap))
          .catch(() => markUserLogin(userId));

        return {
          id: userId,
          email: user.email,
          name: user.fullName || user.email,
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
