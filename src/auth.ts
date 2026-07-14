import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "@/auth.config";
import { rateLimit } from "@/lib/security/rate-limit";
import { inkaiFetch, inkaiErrorMessage } from "@/lib/inkai-api/server";

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
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const identifier = (credentials.email as string).trim();
        const loginLimit = rateLimit(`login:${identifier}`, {
          max: 10,
          windowMs: 15 * 60 * 1000,
        });
        if (!loginLimit.success) return null;

        const { res, data } = await inkaiFetch(
          "/v1/auth/login",
          {
            method: "POST",
            body: JSON.stringify({
              identifier,
              password: credentials.password,
            }),
          },
          null,
        );

        if (!res.ok) return null;

        const token = typeof data.token === "string" ? data.token : null;
        const payload = data.data as { user?: BackendUser } | undefined;
        const user = payload?.user;
        if (!token || !user?.id || !user.email) return null;

        const roles = Array.isArray(user.roles) ? user.roles : [];
        const memberId = user.memberId ?? user.member?.id ?? null;

        return {
          id: user.id,
          email: user.email,
          name: user.fullName || user.email,
          roles,
          managedProvinceId: user.managedProvinceId ?? null,
          managedBranchId: user.managedBranchId ?? null,
          managedDojoId: user.managedDojoId ?? null,
          memberId,
          accessToken: token,
        };
      },
    }),
  ],
});
