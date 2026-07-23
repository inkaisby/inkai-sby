import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  providers: [],
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" as const },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.roles = user.roles;
        token.managedProvinceId = user.managedProvinceId;
        token.managedBranchId = user.managedBranchId;
        token.managedDojoId = user.managedDojoId;
        token.memberId = user.memberId;
        token.name = user.name;
        token.photoUrl = user.photoUrl ?? null;
      }
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
        const photo = (token.photoUrl as string | null | undefined) ?? null;
        session.user.photoUrl = photo;
        session.user.image = photo;
      }
      return session;
    },
  },
  trustHost: true,
} satisfies NextAuthConfig;
