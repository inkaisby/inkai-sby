import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import { NextResponse } from "next/server";
import { canAccessAdmin } from "@/lib/rbac";

const { auth } = NextAuth(authConfig);

const publicPaths = [
  "/",
  "/sejarah",
  "/makna-lambang",
  "/struktur",
  "/visi-misi",
  "/login",
  "/daftar",
];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;
  const user = req.auth?.user;

  const isPublic =
    publicPaths.includes(pathname) ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/dojos");

  if (isPublic) return NextResponse.next();

  if (!isLoggedIn || !user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (pathname.startsWith("/admin")) {
    if (!canAccessAdmin(user)) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  if (pathname.startsWith("/dashboard") && canAccessAdmin(user)) {
    return NextResponse.redirect(new URL("/admin", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
