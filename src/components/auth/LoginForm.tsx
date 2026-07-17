"use client";

import { useState } from "react";
import { signIn, getSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, Loader2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isAdmin } from "@/lib/rbac";
import { AuthTransitionOverlay } from "@/components/auth/AuthTransitionOverlay";
import { showError } from "@/lib/client-toast";

type LoginFormProps = {
  idPrefix?: string;
  onSuccess?: () => void;
  onForgotPassword?: () => void;
};

type LoginPhase = "idle" | "signing-in" | "entering";

export default function LoginForm({
  idPrefix = "login",
  onSuccess,
  onForgotPassword,
}: LoginFormProps) {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<LoginPhase>("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPhase("signing-in");
    setError("");

    const identifierValue = identifier.trim();

    const precheck = await fetch("/api/auth/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: identifierValue,
        password,
      }),
    });
    const preData = await precheck.json().catch(() => ({}));

    if (!precheck.ok) {
      setPhase("idle");
      const msg =
        typeof preData.error === "string"
          ? preData.error
          : "Email/NIA atau password salah.";
      setError(msg);
      showError(msg);
      return;
    }

    const result = await signIn("credentials", {
      email: identifierValue,
      password,
      redirect: false,
    });

    if (result?.error) {
      setPhase("idle");
      const msg =
        "Login gagal membuat sesi. Coba lagi — jika berulang, server autentikasi sedang bermasalah.";
      setError(msg);
      showError(msg);
      return;
    }

    setPhase("entering");

    const session = await getSession();
    const roles: string[] = session?.user?.roles || [];
    const destination = isAdmin(roles) ? "/admin" : "/dashboard";

    onSuccess?.();
    router.refresh();
    router.push(destination);
  }

  const loading = phase !== "idle";
  const overlayMessage =
    phase === "signing-in" ? "Memverifikasi akun..." : "Membuka dashboard INKAI...";

  return (
    <>
      <AuthTransitionOverlay active={loading} message={overlayMessage} />

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-identifier`}>Email atau NIA</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id={`${idPrefix}-identifier`}
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="nama@email.com atau NIA"
              className="pl-9"
              autoComplete="username"
              required
              disabled={loading}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-password`}>Password</Label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id={`${idPrefix}-password`}
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Masukkan password"
              className="pl-9 pr-10"
              autoComplete="current-password"
              required
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
              disabled={loading}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          <div className="flex justify-end">
            {onForgotPassword ? (
              <button
                type="button"
                onClick={onForgotPassword}
                className="text-xs font-medium text-inkai-red hover:underline"
              >
                Lupa password?
              </button>
            ) : (
              <Link
                href="/lupa-password"
                className="text-xs font-medium text-inkai-red hover:underline"
              >
                Lupa password?
              </Link>
            )}
          </div>
        </div>

        {error && (
          <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <Button
          type="submit"
          className="h-11 w-full rounded-xl bg-inkai-red text-base font-semibold hover:bg-inkai-red/90"
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              {phase === "signing-in" ? "Memverifikasi..." : "Membuka dashboard..."}
            </>
          ) : (
            "Login"
          )}
        </Button>
      </form>
    </>
  );
}
