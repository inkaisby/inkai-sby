"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { showError, showSuccess } from "@/lib/client-toast";

export function VerificationActions({
  verificationId,
}: {
  verificationId: string;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

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
