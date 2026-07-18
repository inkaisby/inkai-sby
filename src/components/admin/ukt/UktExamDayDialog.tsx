"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMemberName, formatRankLabel } from "@/lib/belt";
import { isRegistrationApproved, type UktMemberRow } from "@/lib/ukt";
import { parseApiJson } from "@/lib/api-client";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  rows: UktMemberRow[];
  dojos: Array<{ id: string; name: string }>;
  initialDojoId?: string;
  locked?: boolean;
};

export function UktExamDayDialog({
  open,
  onOpenChange,
  eventId,
  rows,
  dojos,
  initialDojoId,
  locked,
}: Props) {
  const participants = useMemo(
    () =>
      rows.filter(
        (r) => r.registrationId && isRegistrationApproved(r.status),
      ),
    [rows],
  );

  const [dojoFilter, setDojoFilter] = useState(initialDojoId || "all");
  const [presentIds, setPresentIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    if (dojoFilter === "all") return participants;
    return participants.filter((r) => r.dojoId === dojoFilter);
  }, [participants, dojoFilter]);

  useEffect(() => {
    if (!open) return;
    setDojoFilter(initialDojoId || "all");
    const initial = new Set<string>();
    for (const r of participants) {
      if (r.registrationId && r.examPresent === true) {
        initial.add(r.registrationId);
      }
    }
    // Default: semua paid/menunggu ujian dianggap hadir jika belum dicatat
    if (initial.size === 0) {
      for (const r of participants) {
        if (
          r.registrationId &&
          r.examPresent == null &&
          (r.billingStatus === "PAID" ||
            r.status === "PAID" ||
            r.status === "SUCCESS")
        ) {
          initial.add(r.registrationId);
        }
      }
    }
    setPresentIds(initial);
  }, [open, initialDojoId, participants]);

  const toggle = (registrationId: string) => {
    setPresentIds((prev) => {
      const next = new Set(prev);
      if (next.has(registrationId)) next.delete(registrationId);
      else next.add(registrationId);
      return next;
    });
  };

  const setAllFiltered = (present: boolean) => {
    setPresentIds((prev) => {
      const next = new Set(prev);
      for (const r of filtered) {
        if (!r.registrationId) continue;
        if (present) next.add(r.registrationId);
        else next.delete(r.registrationId);
      }
      return next;
    });
  };

  const saveAttendance = async () => {
    if (locked) {
      toast.error("Periode dikunci — tidak dapat mengubah kehadiran");
      return;
    }
    const presentRegistrationIds = filtered
      .map((r) => r.registrationId)
      .filter((id): id is string => typeof id === "string" && presentIds.has(id));
    const absentRegistrationIds = filtered
      .map((r) => r.registrationId)
      .filter((id): id is string => typeof id === "string" && !presentIds.has(id));

    setSaving(true);
    try {
      const res = await fetch("/api/admin/ukt/exam-day", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          presentRegistrationIds,
          absentRegistrationIds,
        }),
      });
      const data = await parseApiJson<{ error?: string; message?: string }>(res);
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan");
      toast.success(data.message || "Kehadiran hari-H disimpan");
      onOpenChange(false);
      window.location.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const saveBulkResult = async (result: "LULUS" | "GAGAL" | "MENGULANG") => {
    if (locked) {
      toast.error("Periode dikunci — tidak dapat mengubah hasil ujian");
      return;
    }
    const examResults = filtered
      .filter((r) => r.registrationId && presentIds.has(r.registrationId))
      .map((r) => ({
        registrationId: r.registrationId!,
        result,
      }));
    if (examResults.length === 0) {
      toast.error("Centang peserta hadir terlebih dahulu");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/ukt/exam-day", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, examResults }),
      });
      const data = await parseApiJson<{ error?: string; message?: string }>(res);
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan");
      toast.success(`${examResults.length} hasil ${result} disimpan`);
      onOpenChange(false);
      window.location.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>UKT hari-H — roster ujian</DialogTitle>
          <DialogDescription>
            Tandai kehadiran di tempat, lalu tetapkan hasil massal untuk peserta
            yang hadir.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={dojoFilter} onValueChange={setDojoFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter ranting" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua ranting</SelectItem>
              {dojos.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setAllFiltered(true)}
            disabled={locked}
          >
            Hadir semua
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setAllFiltered(false)}
            disabled={locked}
          >
            Kosongkan
          </Button>
          <span className="text-xs text-muted-foreground">
            {presentIds.size} hadir · {filtered.length} di filter
          </span>
        </div>

        <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border p-2">
          {filtered.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">
              Belum ada peserta disetujui.
            </p>
          ) : (
            filtered.map((r) => (
              <label
                key={r.memberId}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/50"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-inkai-red"
                  checked={Boolean(
                    r.registrationId && presentIds.has(r.registrationId),
                  )}
                  disabled={locked || !r.registrationId}
                  onChange={() =>
                    r.registrationId && toggle(r.registrationId)
                  }
                />
                <span className="min-w-0 flex-1 truncate font-medium">
                  {formatMemberName(r.fullName)}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatRankLabel(r.kyuLama) || "—"} · {r.dojoName}
                </span>
              </label>
            ))
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => void saveAttendance()}
            disabled={saving || locked || filtered.length === 0}
          >
            Simpan kehadiran
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => void saveBulkResult("LULUS")}
              disabled={saving || locked}
            >
              Massal Lulus
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void saveBulkResult("GAGAL")}
              disabled={saving || locked}
            >
              Massal Gagal
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void saveBulkResult("MENGULANG")}
              disabled={saving || locked}
            >
              Massal Mengulang
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
