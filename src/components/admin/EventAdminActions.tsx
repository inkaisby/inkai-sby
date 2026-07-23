"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AdminMoreActions } from "@/components/admin/AdminMoreActions";
import { showError, showSuccess } from "@/lib/client-toast";
import { Users } from "lucide-react";

type Registration = {
  id?: string;
  status?: string;
  member?: { fullName?: string; nia?: string | null };
};

export function EventAdminActions({
  eventId,
  title,
  location,
  startDate,
  endDate,
  canEdit,
  isUkt,
}: {
  eventId: string;
  title: string;
  location?: string | null;
  startDate: string;
  endDate: string;
  canEdit: boolean;
  isUkt: boolean;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [rosterOpen, setRosterOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formTitle, setFormTitle] = useState(title);
  const [formLocation, setFormLocation] = useState(location || "");
  const [formStart, setFormStart] = useState(startDate.slice(0, 16));
  const [formEnd, setFormEnd] = useState(endDate.slice(0, 16));
  const [regs, setRegs] = useState<Registration[]>([]);

  async function saveEdit() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formTitle,
          location: formLocation,
          startDate: new Date(formStart).toISOString(),
          endDate: new Date(formEnd).toISOString(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showError(data.error || "Gagal menyimpan");
        return;
      }
      showSuccess(data.message || "Event diperbarui");
      setEditOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function cancelEvent() {
    if (!confirm(`Tutup event "${title}" sekarang?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cancel: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showError(data.error || "Gagal menutup event");
        return;
      }
      showSuccess(data.message || "Event ditutup");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function openRoster() {
    setRosterOpen(true);
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/events/${eventId}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showError(data.error || "Gagal memuat pendaftar");
        setRegs([]);
        return;
      }
      setRegs((data.registrations as Registration[]) ?? []);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {!isUkt ? (
          <Button size="sm" variant="outline" className="gap-1" onClick={() => void openRoster()}>
            <Users className="h-3.5 w-3.5" />
            Pendaftar
          </Button>
        ) : null}
        {canEdit && !isUkt ? (
          <AdminMoreActions
            items={[
              {
                label: "Ubah",
                onSelect: () => setEditOpen(true),
              },
              {
                label: "Tutup",
                onSelect: () => void cancelEvent(),
                disabled: busy,
                destructive: true,
                separatorBefore: true,
              },
            ]}
          />
        ) : null}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ubah event</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Judul</Label>
              <Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Lokasi</Label>
              <Input
                value={formLocation}
                onChange={(e) => setFormLocation(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Mulai</Label>
              <Input
                type="datetime-local"
                value={formStart}
                onChange={(e) => setFormStart(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Selesai</Label>
              <Input
                type="datetime-local"
                value={formEnd}
                onChange={(e) => setFormEnd(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Batal
            </Button>
            <Button
              className="bg-inkai-red hover:bg-inkai-red/90"
              disabled={busy}
              onClick={() => void saveEdit()}
            >
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rosterOpen} onOpenChange={setRosterOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pendaftar — {title}</DialogTitle>
          </DialogHeader>
          {busy ? (
            <p className="text-sm text-muted-foreground">Memuat…</p>
          ) : regs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada pendaftar.</p>
          ) : (
            <ul className="max-h-80 space-y-2 overflow-y-auto text-sm">
              {regs.map((r, i) => (
                <li key={String(r.id ?? i)} className="rounded border px-3 py-2">
                  <p className="font-medium">{r.member?.fullName ?? "—"}</p>
                  <p className="text-muted-foreground">
                    {r.member?.nia || "—"}
                    {r.status ? ` · ${r.status}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
