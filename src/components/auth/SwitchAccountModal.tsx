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
import { resolvePageForNewAccount } from "@/lib/auth/post-login-redirect";
import { loginErrorMessage } from "@/lib/auth/login-errors";
import { getPrimaryAdminRole, ROLE_LABELS } from "@/lib/rbac";
import { showError, showSuccess } from "@/lib/client-toast";
import { rememberSwitchAccount } from "@/lib/switch-accounts-storage";

type Phase = "idle" | "switching" | "adapting";

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
      // Jangan reset saat overlay ganti-akun sedang jalan (dialog sudah ditutup).
      if (phase === "switching" || phase === "adapting") return;
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
  }, [open, initialEmail, resetForm, phase]);

  // Setelah navigasi selesai, bersihkan state overlay.
  useEffect(() => {
    if (phase === "adapting" || phase === "switching") {
      resetForm();
    }
    // Hanya saat pathname berubah (bukan saat phase berubah).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset on route change only
  }, [pathname]);

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

    setPhase("switching");
    setError("");
    onOpenChange(false);

    try {
      // Presence clear sekali di events.signOut — tanpa validate ganda ke Inkai.
      await signOut({ redirect: false });

      const result = await signIn("credentials", {
        email: trimmedId,
        password,
        redirect: false,
      });

      if (result?.error) {
        setPhase("idle");
        const msg = loginErrorMessage(result.code);
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

      showSuccess(`Berhasil ganti ke ${displayName} (${roleLabel})`);
      rememberSwitchAccount(trimmedId);
      if (currentEmail) rememberSwitchAccount(currentEmail);

      if (targetPath !== fullCurrentPath) {
        router.push(targetPath);
        router.refresh();
      } else {
        router.refresh();
        window.setTimeout(() => resetForm(), 350);
      }
    } catch {
      setPhase("idle");
      showError("Terjadi kesalahan saat mengganti akun. Silakan coba lagi.");
      onOpenChange(true);
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
              {phase === "switching" || phase === "adapting" ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  {phase === "switching" ? "Mengganti..." : "Menyesuaikan..."}
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
