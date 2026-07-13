import type { NextAuthConfig } from "next-auth";
import type { Role } from "@prisma/client";

export const authConfig = {
  providers: [],
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" as const },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.scopeProvinsiId = user.scopeProvinsiId;
        token.scopeCabangId = user.scopeCabangId;
        token.scopeDojoId = user.scopeDojoId;
        token.anggotaId = user.anggotaId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        session.user.role = token.role as Role;
        session.user.scopeProvinsiId = token.scopeProvinsiId as string | null;
        session.user.scopeCabangId = token.scopeCabangId as string | null;
        session.user.scopeDojoId = token.scopeDojoId as string | null;
        session.user.anggotaId = token.anggotaId as string | null;
      }
      return session;
    },
  },
  trustHost: true,
} satisfies NextAuthConfig;
