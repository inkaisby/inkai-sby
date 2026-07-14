"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AuthShell from "@/components/auth/AuthShell";
import LoginForm from "@/components/auth/LoginForm";
import RegisterForm from "@/components/auth/RegisterForm";

function AuthTabs() {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") === "daftar" ? "daftar" : "login";
  const dojo = searchParams.get("dojo") || "";

  return (
    <>
      <div className="mb-6 flex rounded-xl bg-muted p-1">
        <Link
          href="/login"
          className={`flex-1 rounded-lg py-2.5 text-center text-sm font-medium transition-colors ${
            tab === "login"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Login
        </Link>
        <Link
          href={dojo ? `/login?tab=daftar&dojo=${dojo}` : "/login?tab=daftar"}
          className={`flex-1 rounded-lg py-2.5 text-center text-sm font-medium transition-colors ${
            tab === "daftar"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Daftar
        </Link>
      </div>

      {tab === "login" ? (
        <>
          <LoginForm />
          <p className="mt-5 text-center text-sm text-muted-foreground">
            Belum punya akun?{" "}
            <Link
              href={dojo ? `/login?tab=daftar&dojo=${dojo}` : "/login?tab=daftar"}
              className="font-medium text-inkai-red hover:underline"
            >
              Daftar di sini
            </Link>
          </p>
        </>
      ) : (
        <>
          <RegisterForm preselectedDojo={dojo} />
          <p className="mt-5 text-center text-sm text-muted-foreground">
            Sudah punya akun?{" "}
            <Link href="/login" className="font-medium text-inkai-red hover:underline">
              Login di sini
            </Link>
          </p>
        </>
      )}
    </>
  );
}

export default function LoginPage() {
  return (
    <AuthShell
      title="INKAI Surabaya"
      subtitle={
        "Masuk atau daftar sebagai anggota Institut Karate-Do Indonesia"
      }
    >
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}>
        <AuthTabs />
      </Suspense>
    </AuthShell>
  );
}
