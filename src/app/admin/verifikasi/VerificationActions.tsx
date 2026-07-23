"use client";

import { useState, startTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { showError, showSuccess } from "@/lib/client-toast";
import { generateSimplePassword } from "@/lib/security/password";
import { useOptimisticHide } from "@/components/admin/OptimisticHide";

export function VerificationActions({
  verificationId,
  type,
  nameHint,
}: {
  verificationId: string;
  type?: string;
  nameHint?: string | null;
}) {
  const router = useRouter();
  const hideCard = useOptimisticHide();
  const [notes, setNotes] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const isPasswordReset = type === "PASSWORD_RESET";

  function fillGeneratedPassword() {
    const password = generateSimplePassword(nameHint || "Anggota");
    setNewPassword(password);
    setConfirmPassword(password);
    showSuccess(`Password diisi: ${password}`);
  }

  async function handleAction(action: "approve" | "reject") {
    setLoading(true);
    const res = await fetch(`/api/admin/verifications/${verificationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        ...(notes.trim() ? { adminNotes: notes.trim() } : {}),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (res.ok) {
      showSuccess(data.message || "Verifikasi berhasil disimpan");
      hideCard?.();
      startTransition(() => router.refresh());
    } else {
      showError(data.error || "Gagal memproses verifikasi");
    }
  }

  async function handleResetPassword() {
    if (newPassword.length < 8) {
      showError("Password minimal 8 karakter");
      return;
    }
    if (newPassword !== confirmPassword) {
      showError("Konfirmasi password tidak cocok");
      return;
    }

    setLoading(true);
    const res = await fetch(
      `/api/admin/verifications/${verificationId}/reset-password`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newPassword,
          ...(notes.trim() ? { adminNotes: notes.trim() } : {}),
        }),
      },
    );
    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (res.ok) {
      showSuccess(data.message || "Password berhasil diubah");
      setNewPassword("");
      setConfirmPassword("");
      hideCard?.();
      startTransition(() => router.refresh());
    } else {
      showError(data.error || "Gagal mengubah password");
    }
  }

  if (isPasswordReset) {
    return (
      <div className="space-y-2 rounded-lg border border-inkai-red/20 bg-inkai-red/5 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-semibold text-inkai-red">
            Ubah password email anggota
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={fillGeneratedPassword}
            disabled={loading}
          >
            <Sparkles className="size-3.5" />
            Generate Password
          </Button>
        </div>
        <Input
          type="text"
          placeholder="Password baru"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="h-8 w-full max-w-sm"
          autoComplete="new-password"
        />
        <Input
          type="text"
          placeholder="Konfirmasi password baru"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="h-8 w-full max-w-sm"
          autoComplete="new-password"
        />
        <Input
          placeholder="Catatan admin (opsional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="h-8 w-full max-w-sm"
        />
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            size="sm"
            className="h-8 w-full bg-green-600 hover:bg-green-700 sm:w-auto"
            disabled={loading}
            onClick={handleResetPassword}
          >
            Setujui & Ubah Password
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="h-8 w-full sm:w-auto"
            disabled={loading}
            onClick={() => handleAction("reject")}
          >
            Tolak
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Input
        placeholder="Catatan admin (opsional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        className="h-8 w-full max-w-sm"
      />
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          size="sm"
          className="h-8 w-full bg-green-600 hover:bg-green-700 sm:w-auto"
          disabled={loading}
          onClick={() => handleAction("approve")}
        >
          Setujui
        </Button>
        <Button
          size="sm"
          variant="destructive"
          className="h-8 w-full sm:w-auto"
          disabled={loading}
          onClick={() => handleAction("reject")}
        >
          Tolak
        </Button>
      </div>
    </div>
  );
}
