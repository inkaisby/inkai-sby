"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { showError, showSuccess } from "@/lib/client-toast";

export function VerificationActions({
  verificationId,
  type,
}: {
  verificationId: string;
  type?: string;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const isPasswordReset = type === "PASSWORD_RESET";

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
      router.refresh();
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
      router.refresh();
    } else {
      showError(data.error || "Gagal mengubah password");
    }
  }

  if (isPasswordReset) {
    return (
      <div className="space-y-2 rounded-lg border border-inkai-red/20 bg-inkai-red/5 p-3">
        <p className="text-xs font-semibold text-inkai-red">
          Ubah password email anggota
        </p>
        <Input
          type="password"
          placeholder="Password baru"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="h-8 max-w-sm"
          autoComplete="new-password"
        />
        <Input
          type="password"
          placeholder="Konfirmasi password baru"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="h-8 max-w-sm"
          autoComplete="new-password"
        />
        <Input
          placeholder="Catatan admin (opsional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="h-8 max-w-sm"
        />
        <div className="flex flex-wrap gap-1">
          <Button
            size="sm"
            className="h-8 bg-green-600 hover:bg-green-700"
            disabled={loading}
            onClick={handleResetPassword}
          >
            Setujui & Ubah Password
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="h-8"
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
        className="h-8 max-w-sm"
      />
      <div className="flex gap-1">
        <Button
          size="sm"
          className="h-8 bg-green-600 hover:bg-green-700"
          disabled={loading}
          onClick={() => handleAction("approve")}
        >
          Setujui
        </Button>
        <Button
          size="sm"
          variant="destructive"
          className="h-8"
          disabled={loading}
          onClick={() => handleAction("reject")}
        >
          Tolak
        </Button>
      </div>
    </div>
  );
}
