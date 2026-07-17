"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { showError, showSuccess } from "@/lib/client-toast";
import { Loader2, Pencil } from "lucide-react";

type Props = {
  billingId: string;
  status: string;
  amount: number;
  dueDate: string;
  description?: string | null;
  canEdit: boolean;
};

export function BillingActions({
  billingId,
  status,
  amount,
  dueDate,
  description,
  canEdit,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState("");
  const [editAmount, setEditAmount] = useState(String(Math.round(amount)));
  const [editDue, setEditDue] = useState(
    dueDate ? new Date(dueDate).toISOString().slice(0, 10) : "",
  );
  const [editDesc, setEditDesc] = useState(description || "");

  const unpaid =
    status === "PENDING" ||
    status === "WAITING_VERIFICATION" ||
    status === "REJECTED";

  async function patch(body: Record<string, unknown>) {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/billing/${billingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showError(data.error || "Gagal memproses iuran");
        return;
      }
      showSuccess(data.message || "Berhasil disimpan");
      setEditing(false);
      setNotes("");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function saveEdit() {
    const amountNum = Number(editAmount);
    if (!Number.isFinite(amountNum) || amountNum < 0) {
      showError("Nominal tidak valid");
      return;
    }
    await patch({
      action: "update",
      amount: amountNum,
      dueDate: editDue
        ? new Date(`${editDue}T00:00:00`).toISOString()
        : undefined,
      description: editDesc.trim() || null,
    });
  }

  if (!canEdit) return null;

  return (
    <div className="flex w-full max-w-xs flex-col items-end gap-2">
      {unpaid && (
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1"
          disabled={loading}
          onClick={() => setEditing((v) => !v)}
        >
          <Pencil className="size-3.5" />
          {editing ? "Tutup" : "Edit"}
        </Button>
      )}

      {editing && unpaid && (
        <div className="w-full space-y-2 rounded-lg border bg-muted/30 p-2 text-left">
          <label className="block text-xs font-medium">Nominal (Rp)</label>
          <Input
            type="number"
            className="h-8"
            value={editAmount}
            onChange={(e) => setEditAmount(e.target.value)}
          />
          <label className="block text-xs font-medium">Jatuh tempo</label>
          <Input
            type="date"
            className="h-8"
            value={editDue}
            onChange={(e) => setEditDue(e.target.value)}
          />
          <label className="block text-xs font-medium">Deskripsi</label>
          <Input
            className="h-8"
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
            placeholder="Iuran bulanan..."
          />
          <Button
            size="sm"
            className="h-8 w-full bg-inkai-red hover:bg-inkai-red/90"
            disabled={loading}
            onClick={() => void saveEdit()}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Simpan perubahan"}
          </Button>
        </div>
      )}

      {unpaid && (
        <Input
          placeholder="Catatan (opsional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="h-8 w-full"
        />
      )}

      <div className="flex flex-wrap justify-end gap-1">
        {status === "WAITING_VERIFICATION" && (
          <>
            <Button
              size="sm"
              className="h-7 bg-green-600 hover:bg-green-700"
              disabled={loading}
              onClick={() =>
                void patch({
                  action: "approve",
                  ...(notes.trim() ? { adminNotes: notes.trim() } : {}),
                })
              }
            >
              Setujui
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="h-7"
              disabled={loading}
              onClick={() =>
                void patch({
                  action: "reject",
                  ...(notes.trim() ? { adminNotes: notes.trim() } : {}),
                })
              }
            >
              Tolak
            </Button>
          </>
        )}

        {(status === "PENDING" || status === "REJECTED") && (
          <Button
            size="sm"
            className="h-7 bg-emerald-700 hover:bg-emerald-800"
            disabled={loading}
            onClick={() =>
              void patch({
                action: "mark_paid",
                ...(notes.trim() ? { adminNotes: notes.trim() } : {}),
              })
            }
          >
            Tandai Lunas
          </Button>
        )}

        {status === "WAITING_VERIFICATION" && (
          <Button
            size="sm"
            variant="outline"
            className="h-7"
            disabled={loading}
            onClick={() =>
              void patch({
                action: "mark_paid",
                ...(notes.trim() ? { adminNotes: notes.trim() } : {}),
              })
            }
          >
            Lunas (tunai)
          </Button>
        )}
      </div>
    </div>
  );
}
