"use client";

import { Suspense, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, Loader2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthTransitionOverlay } from "@/components/auth/AuthTransitionOverlay";
import { loginErrorMessage } from "@/lib/auth/login-errors";
import { safeCallbackUrl } from "@/lib/auth/safe-callback-url";
import { showError } from "@/lib/client-toast";

type LoginFormProps = {
  idPrefix?: string;
  onSuccess?: () => void;
  onForgotPassword?: () => void;
  /** Shown when Auth.js cookie exists but inkai_token is gone. */
  sessionExpiredHint?: boolean;
};

type LoginPhase = "idle" | "signing-in" | "entering";

function LoginFormInner({
  idPrefix = "login",
  onSuccess,
  onForgotPassword,
  sessionExpiredHint = false,
}: LoginFormProps) {
  const searchParams = useSearchParams();
  const callbackUrl = safeCallbackUrl(searchParams.get("callbackUrl"));
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<LoginPhase>("idle");

  // Warm portal + inkai-backend before submit (cold start often dominates login latency).
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/auth/health", {
      cache: "no-store",
      signal: controller.signal,
    }).catch(() => {});
    return () => controller.abort();
  }, []);

  // Back / bfcache must not leave the form stuck on "Membuka dashboard…".
  useEffect(() => {
    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) {
        setPhase("idle");
      }
    }
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  function readEntryHint(): string | null {
    if (typeof document === "undefined") return null;
    const match = document.cookie.match(/(?:^|;\s*)inkai_entry=([^;]+)/);
    if (!match?.[1]) return null;
    const value = decodeURIComponent(match[1]);
    if (value !== "/dashboard" && value !== "/admin") return null;
    document.cookie = "inkai_entry=; Max-Age=0; path=/";
    return value;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPhase("signing-in");
    setError("");

    const identifierValue = identifier.trim();

    // Satu kali login ke Inkai lewat authorize — tanpa precheck /validate.
    const result = await signIn("credentials", {
      email: identifierValue,
      password,
      redirect: false,
    });

    if (result?.error) {
      setPhase("idle");
      // Auth.js may return custom code on CredentialsSignin; fall back carefully.
      const rawCode =
        typeof result.code === "string" && result.code
          ? result.code
          : result.error === "Configuration"
            ? "server_error"
            : null;
      const msg = loginErrorMessage(rawCode);
      setError(msg);
      showError(msg);
      return;
    }

    setPhase("entering");

    // Prefer server hint (admin-only → /admin) to avoid /dashboard redirect hop.
    const destination = callbackUrl ?? readEntryHint() ?? "/dashboard";

    onSuccess?.();
    // Full navigation so App Router does not reuse a pre-login RSC cache
    // that redirects back to /login while cookies are already set.
    window.location.assign(destination);
  }

  const loading = phase !== "idle";
  const overlayMessage =
    phase === "signing-in" ? "Memverifikasi akun..." : "Membuka dashboard INKAI...";

  return (
    <>
      <AuthTransitionOverlay active={loading} message={overlayMessage} />

      <form onSubmit={handleSubmit} className="space-y-5">
        {sessionExpiredHint && (
          <p className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
            Sesi kedaluwarsa. Masuk ulang untuk melanjutkan.
          </p>
        )}

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
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Login pertama ber-NIA: isi NIA sebagai username dan password, lalu
            ganti password di Profil agar akun lebih aman. Email tanpa NIA tetap
            bisa dipakai login.
          </p>
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

export default function LoginForm(props: LoginFormProps) {
  return (
    <Suspense fallback={<div className="h-48 animate-pulse rounded-xl bg-muted" />}>
      <LoginFormInner {...props} />
    </Suspense>
  );
}
