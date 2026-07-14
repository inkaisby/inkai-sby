"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { showError, showSuccess } from "@/lib/client-toast";

export function MemberActions({
  memberId,
  status,
}: {
  memberId: string;
  status: string;
}) {
  const router = useRouter();
  const [nia, setNia] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleAction(action: "approve" | "reject") {
    setLoading(true);
    const res = await fetch(`/api/admin/members/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        ...(action === "approve" && nia ? { nia } : {}),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (res.ok) {
      showSuccess(data.message || "Aksi berhasil disimpan");
      router.refresh();
    } else {
      showError(data.error || "Gagal memproses aksi");
    }
  }

  if (status === "Active") {
    return <span className="text-xs text-muted-foreground">Disetujui</span>;
  }
  if (status === "REJECTED") {
    return <span className="text-xs text-destructive">Ditolak</span>;
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Input
        placeholder="NIA (opsional)"
        value={nia}
        onChange={(e) => setNia(e.target.value)}
        className="h-8 w-28"
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
