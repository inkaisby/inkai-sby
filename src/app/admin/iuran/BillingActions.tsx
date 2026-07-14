"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { showError, showSuccess } from "@/lib/client-toast";

export function BillingActions({ billingId }: { billingId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleAction(action: "approve" | "reject") {
    setLoading(true);
    const res = await fetch(`/api/admin/billing/${billingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (res.ok) {
      showSuccess(data.message || "Verifikasi iuran berhasil disimpan");
      router.refresh();
    } else {
      showError(data.error || "Gagal memproses verifikasi iuran");
    }
  }

  return (
    <div className="flex gap-1">
      <Button
        size="sm"
        className="h-7 bg-green-600 hover:bg-green-700"
        disabled={loading}
        onClick={() => handleAction("approve")}
      >
        Setujui
      </Button>
      <Button
        size="sm"
        variant="destructive"
        className="h-7"
        disabled={loading}
        onClick={() => handleAction("reject")}
      >
        Tolak
      </Button>
    </div>
  );
}
