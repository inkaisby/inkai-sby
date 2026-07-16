"use client";

import { useState } from "react";
import { Mail, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { showError, showSuccess } from "@/lib/client-toast";

type ForgotPasswordFormProps = {
  idPrefix?: string;
  onSuccess?: () => void;
  onBackToLogin?: () => void;
};

export default function ForgotPasswordForm({
  idPrefix = "forgot",
  onSuccess,
  onBackToLogin,
}: ForgotPasswordFormProps) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      showError(data.error || "Gagal mengirim pengajuan");
      return;
    }

    setDone(true);
    showSuccess(
      data.message ||
        "Pengajuan reset password telah dikirim ke ranting Anda.",
    );
    onSuccess?.();
  }

  if (done) {
    return (
      <div className="space-y-4 text-center">
        <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-3 text-sm text-emerald-700 dark:text-emerald-400">
          Pengajuan berhasil dikirim. Admin/ranting akan memverifikasi dan
          mengatur ulang password akun Anda.
        </p>
        {onBackToLogin ? (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={onBackToLogin}
          >
            Kembali ke login
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Masukkan email terdaftar. Pengajuan akan diteruskan ke ranting/dojo
        Anda untuk diverifikasi dan diubah passwordnya.
      </p>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-email`}>Email</Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id={`${idPrefix}-email`}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nama@email.com"
            className="pl-9"
            required
            disabled={loading}
          />
        </div>
      </div>
      <Button
        type="submit"
        className="h-11 w-full rounded-xl bg-inkai-red text-base font-semibold hover:bg-inkai-red/90"
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Mengirim...
          </>
        ) : (
          "Ajukan ke Ranting"
        )}
      </Button>
      {onBackToLogin ? (
        <button
          type="button"
          onClick={onBackToLogin}
          className="w-full text-center text-sm font-medium text-inkai-red hover:underline"
        >
          Kembali ke login
        </button>
      ) : null}
    </form>
  );
}
