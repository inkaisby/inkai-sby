"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { canAssignNia } from "@/lib/belt";
import { showError, showSuccess } from "@/lib/client-toast";

export function MemberActions({
  memberId,
  status,
  nia,
  userRoles = [],
  compact = false,
  onSuccess,
}: {
  memberId: string;
  status: string;
  nia?: string | null;
  userRoles?: string[];
  compact?: boolean;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [niaInput, setNiaInput] = useState(nia || "");
  const [loading, setLoading] = useState(false);
  const assignNia = canAssignNia(userRoles);
  const needsNia = !nia?.trim();

  useEffect(() => {
    setNiaInput(nia || "");
  }, [nia, memberId]);

  async function handleAction(action: "approve" | "reject" | "set_nia") {
    if (action === "set_nia" && !niaInput.trim()) {
      showError("NIA wajib diisi");
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/admin/members/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        ...(niaInput.trim() ? { nia: niaInput.trim() } : {}),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (res.ok) {
      showSuccess(data.message || "Aksi berhasil disimpan");
      onSuccess?.();
      router.refresh();
    } else {
      showError(data.error || "Gagal memproses aksi");
    }
  }

  if (status === "Active") {
    if (assignNia && needsNia) {
      return (
        <div
          className={
            compact
              ? "flex flex-col gap-2"
              : "flex flex-col gap-2 sm:flex-row sm:items-center"
          }
        >
          <Input
            placeholder="Isi NIA"
            value={niaInput}
            onChange={(e) => setNiaInput(e.target.value)}
            className="h-8 w-28"
          />
          <Button
            size="sm"
            className="h-8 bg-inkai-red"
            disabled={loading}
            onClick={() => handleAction("set_nia")}
          >
            Simpan NIA
          </Button>
        </div>
      );
    }
    return (
      <span className="text-xs text-muted-foreground">
        {nia?.trim() ? "Disetujui" : "Aktif · tanpa NIA"}
      </span>
    );
  }

  if (status === "REJECTED") {
    return <span className="text-xs text-destructive">Ditolak</span>;
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      {assignNia ? (
        <Input
          placeholder="NIA (opsional)"
          value={niaInput}
          onChange={(e) => setNiaInput(e.target.value)}
          className="h-8 w-28"
        />
      ) : null}
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
