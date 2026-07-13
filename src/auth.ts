import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/auth.config";
import type { Role } from "@prisma/client";

declare module "next-auth" {
  interface User {
    role: Role;
    scopeProvinsiId?: string | null;
    scopeCabangId?: string | null;
    scopeDojoId?: string | null;
    anggotaId?: string | null;
  }
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: Role;
      scopeProvinsiId?: string | null;
      scopeCabangId?: string | null;
      scopeDojoId?: string | null;
      anggotaId?: string | null;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    role: Role;
    scopeProvinsiId?: string | null;
    scopeCabangId?: string | null;
    scopeDojoId?: string | null;
    anggotaId?: string | null;
  }
}

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

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user) return null;

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          scopeProvinsiId: user.scopeProvinsiId,
          scopeCabangId: user.scopeCabangId,
          scopeDojoId: user.scopeDojoId,
          anggotaId: user.anggotaId,
        };
      },
    }),
  ],
});
