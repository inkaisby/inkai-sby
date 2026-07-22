"use client";

import { useCallback, useEffect, useState } from "react";
import { getSession, signIn, signOut } from "next-auth/react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeftRight, Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthTransitionOverlay } from "@/components/auth/AuthTransitionOverlay";
import { useNavigation } from "@/components/layout/NavigationProvider";
import { resolvePageForNewAccount } from "@/lib/auth/post-login-redirect";
import { getPrimaryAdminRole, ROLE_LABELS } from "@/lib/rbac";
import { showError, showSuccess } from "@/lib/client-toast";
import { rememberSwitchAccount } from "@/lib/switch-accounts-storage";

const MIN_TRANSITION_MS = 750;

type Phase = "idle" | "validating" | "switching" | "adapting";

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function SwitchAccountModal({
  open,
  onOpenChange,
  currentEmail,
  initialEmail = "",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentEmail: string;
  /** Prefill dari daftar akun gabungan / riwayat. */
  initialEmail?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { startNavigation } = useNavigation();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");

  const resetForm = useCallback(() => {
    setIdentifier("");
    setPassword("");
    setShowPassword(false);
    setError("");
    setPhase("idle");
  }, []);

  useEffect(() => {
    if (!open) {
      resetForm();
      return;
    }
    const prefill = initialEmail.trim();
    if (prefill) {
      setIdentifier(prefill);
      setPassword("");
      setError("");
      setPhase("idle");
    }
  }, [open, initialEmail, resetForm]);

  const overlayActive = phase === "switching" || phase === "adapting";
  const overlayMessage =
    phase === "switching"
      ? "Mengganti akun..."
      : "Menyesuaikan halaman...";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedId = identifier.trim();

    if (!trimmedId || !password) return;

    if (
      currentEmail &&
      trimmedId.toLowerCase() === currentEmail.toLowerCase()
    ) {
      setError("Anda sudah menggunakan akun ini. Masukkan akun lain.");
      return;
    }

    setPhase("validating");
    setError("");

    const startedAt = Date.now();

    try {
      const validateRes = await fetch("/api/auth/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: trimmedId, password }),
      });

      if (!validateRes.ok) {
        const payload = (await validateRes.json().catch(() => ({}))) as {
          error?: string;
        };
        const msg =
          payload.error ||
          "Email/NIA atau password salah. Akun baru perlu disetujui admin terlebih dahulu.";
        setError(msg);
        setPhase("idle");
        return;
      }

      onOpenChange(false);
      setPhase("switching");

      const { clearPresenceBeforeLogout } = await import(
        "@/components/presence/PresenceHeartbeat"
      );
      await clearPresenceBeforeLogout();
      await signOut({ redirect: false });

      const result = await signIn("credentials", {
        email: trimmedId,
        password,
        redirect: false,
      });

      if (result?.error) {
        setPhase("idle");
        const msg = "Gagal mengganti akun. Silakan login ulang.";
        showError(msg);
        router.push("/login");
        return;
      }

      setPhase("adapting");

      const session = await getSession();
      const roles = session?.user?.roles ?? [];
      const memberId = session?.user?.memberId ?? null;
      const search =
        typeof window !== "undefined"
          ? window.location.search.replace(/^\?/, "")
          : "";
      const fullCurrentPath = `${pathname}${search ? `?${search}` : ""}`;
      const targetPath = resolvePageForNewAccount(pathname, roles, search, memberId);

      const primaryRole = getPrimaryAdminRole(roles);
      const roleLabel = ROLE_LABELS[primaryRole] || primaryRole;
      const displayName = session?.user?.name || trimmedId;

      if (targetPath !== fullCurrentPath) {
        startNavigation(targetPath);
        router.push(targetPath);
      }

      router.refresh();

      const elapsed = Date.now() - startedAt;
      await wait(Math.max(0, MIN_TRANSITION_MS - elapsed));

      showSuccess(`Berhasil ganti ke ${displayName} (${roleLabel})`);
      rememberSwitchAccount(trimmedId);
      if (currentEmail) rememberSwitchAccount(currentEmail);
      resetForm();
    } catch {
      setPhase("idle");
      showError("Terjadi kesalahan saat mengganti akun. Silakan coba lagi.");
    }
  }

  const loading = phase !== "idle";

  return (
    <>
      <AuthTransitionOverlay active={overlayActive} message={overlayMessage} />

      <Dialog open={open} onOpenChange={(next) => !loading && onOpenChange(next)}>
        <DialogContent className="gap-0 overflow-hidden border-border/60 p-0 sm:max-w-md">
          <div className="border-b bg-gradient-to-br from-inkai-red/8 via-background to-inkai-yellow/8 px-6 pb-5 pt-6">
            <DialogHeader className="items-center text-center">
              <div className="mb-3 rounded-full bg-background p-1 shadow-md ring-1 ring-border/60">
                <Image
                  src="/logo-inkai.png"
                  alt="Logo INKAI"
                  width={56}
                  height={56}
                  className="rounded-full"
                />
              </div>
              <DialogTitle className="text-lg font-bold">Ganti Akun</DialogTitle>
              <DialogDescription>
                Masuk dengan akun lain. Halaman akan menyesuaikan sesuai peran akun
                baru — misalnya dari Admin Cabang ke Ketua Ranting.
              </DialogDescription>
            </DialogHeader>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 px-6 py-5">
            <div className="space-y-2">
              <Label htmlFor="switch-identifier">Email atau NIA</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="switch-identifier"
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="nama@email.com atau NIA"
                  className="pl-9"
                  autoComplete="username"
                  required
                  disabled={loading}
                  autoFocus
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="switch-password">Password</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="switch-password"
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
              {phase === "validating" ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Memverifikasi...
                </>
              ) : (
                <>
                  <ArrowLeftRight className="mr-2 size-4" />
                  Ganti Akun
                </>
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
