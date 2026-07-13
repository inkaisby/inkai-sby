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
  const role = req.auth?.user?.role;

  const isPublic =
    publicPaths.includes(pathname) ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/dojos") ||
    pathname.startsWith("/artikel");

  if (isPublic) return NextResponse.next();

  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (pathname.startsWith("/admin")) {
    if (!role || !canAccessAdmin({ ...req.auth!.user!, role })) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  if (pathname.startsWith("/dashboard") && role && role !== "ANGGOTA") {
    if (canAccessAdmin({ ...req.auth!.user!, role })) {
      return NextResponse.redirect(new URL("/admin", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
