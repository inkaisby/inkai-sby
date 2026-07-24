"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AppreciationKind } from "@prisma/client";
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
import { FileUploadField } from "@/components/admin/FileUploadField";
import { showError, showSuccess } from "@/lib/client-toast";
import {
  polishAppreciationSummary,
  summaryHintForKind,
  summaryPlaceholderForKind,
  titlePlaceholderForKind,
} from "@/lib/polish-summary";
import { ArrowDown, ArrowUp, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export type AppreciationAdminItem = {
  id: string;
  kind: AppreciationKind;
  name: string;
  title: string | null;
  summary: string;
  photoUrl: string | null;
  eventDate: string | null;
  order: number;
  isActive: boolean;
};

function toDateInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

type FormFields = {
  kind: AppreciationKind;
  name: string;
  title: string;
  summary: string;
  photoUrl: string;
  eventDate: string;
};

const emptyForm = (): FormFields => ({
  kind: "PRESTASI",
  name: "",
  title: "",
  summary: "",
  photoUrl: "",
  eventDate: "",
});

function SummaryField({
  kind,
  value,
  onChange,
  id,
}: {
  kind: AppreciationKind;
  value: string;
  onChange: (v: string) => void;
  id: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor={id}>Ringkasan</Label>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 text-xs"
          onClick={() => onChange(polishAppreciationSummary(value))}
          disabled={!value.trim()}
        >
          <Sparkles className="h-3.5 w-3.5" />
          Rapikan teks
        </Button>
      </div>
      <textarea
        id={id}
        className="flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        rows={5}
        placeholder={summaryPlaceholderForKind(kind)}
      />
      <p className="text-xs text-muted-foreground">{summaryHintForKind(kind)}</p>
    </div>
  );
}

export function ApresiasiManager({
  initialItems,
}: {
  initialItems: AppreciationAdminItem[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(
    [...initialItems].sort((a, b) => a.order - b.order),
  );
  const [filter, setFilter] = useState<"ALL" | AppreciationKind>("ALL");
  const [form, setForm] = useState<FormFields>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<AppreciationAdminItem | null>(null);
  const [editForm, setEditForm] = useState<FormFields>(emptyForm);
  const [savingEdit, setSavingEdit] = useState(false);

  const visible = useMemo(
    () => (filter === "ALL" ? items : items.filter((i) => i.kind === filter)),
    [items, filter],
  );

  function openEdit(item: AppreciationAdminItem) {
    setEditing(item);
    setEditForm({
      kind: item.kind,
      name: item.name,
      title: item.title ?? "",
      summary: item.summary,
      photoUrl: item.photoUrl ?? "",
      eventDate: toDateInput(item.eventDate),
    });
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const summary = polishAppreciationSummary(form.summary);
    const res = await fetch("/api/admin/apresiasi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: form.kind,
        name: form.name,
        title: form.title || null,
        summary,
        photoUrl: form.photoUrl || null,
        eventDate: form.eventDate || null,
        order: items.length,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (res.ok) {
      showSuccess(data.message || "Apresiasi berhasil ditambahkan");
      setForm(emptyForm());
      router.refresh();
    } else {
      showError(data.error || "Gagal menambah apresiasi");
    }
  }

  async function handleUpdate() {
    if (!editing) return;
    setSavingEdit(true);
    const summary = polishAppreciationSummary(editForm.summary);
    const res = await fetch(`/api/admin/apresiasi/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: editForm.kind,
        name: editForm.name,
        title: editForm.title || null,
        summary,
        photoUrl: editForm.photoUrl || null,
        eventDate: editForm.eventDate || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSavingEdit(false);
    if (res.ok) {
      setItems((prev) =>
        prev.map((i) =>
          i.id === editing.id
            ? {
                ...i,
                kind: editForm.kind,
                name: editForm.name,
                title: editForm.title || null,
                summary,
                photoUrl: editForm.photoUrl || null,
                eventDate: editForm.eventDate
                  ? new Date(editForm.eventDate).toISOString()
                  : null,
              }
            : i,
        ),
      );
      showSuccess(data.message || "Apresiasi berhasil diperbarui");
      setEditing(null);
      router.refresh();
    } else {
      showError(data.error || "Gagal memperbarui");
    }
  }

  async function toggleActive(id: string, isActive: boolean) {
    const res = await fetch(`/api/admin/apresiasi/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, isActive: !isActive } : i)),
      );
      showSuccess(data.message || "Berhasil diperbarui");
    } else {
      showError(data.error || "Gagal memperbarui");
    }
  }

  async function move(id: string, dir: -1 | 1) {
    const idx = items.findIndex((i) => i.id === id);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= items.length) return;
    const next = [...items];
    [next[idx], next[swap]] = [next[swap], next[idx]];
    const withOrder = next.map((item, order) => ({ ...item, order }));
    setItems(withOrder);
    await Promise.all(
      withOrder.map((item) =>
        fetch(`/api/admin/apresiasi/${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order: item.order }),
        }),
      ),
    );
    showSuccess("Urutan diperbarui");
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("Hapus entri apresiasi ini?")) return;
    const res = await fetch(`/api/admin/apresiasi/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setItems((prev) => prev.filter((i) => i.id !== id));
      showSuccess(data.message || "Berhasil dihapus");
      router.refresh();
    } else {
      showError(data.error || "Gagal menghapus");
    }
  }

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-xl border border-border/80 bg-card">
        <div className="border-b border-border/60 bg-muted/30 px-4 py-3">
          <p className="text-sm font-medium">Tambah apresiasi</p>
          <p className="text-xs text-muted-foreground">
            Judul singkat di field jabatan; narasi berparagraf di ringkasan.
          </p>
        </div>
        <form
          onSubmit={handleCreate}
          className="grid gap-4 p-4 sm:grid-cols-2"
        >
          <div className="space-y-2">
            <Label>Jenis</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={form.kind}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  kind: e.target.value as AppreciationKind,
                }))
              }
            >
              <option value="PRESTASI">Prestasi</option>
              <option value="KENANGAN">Kenangan</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>Tanggal (opsional)</Label>
            <Input
              type="date"
              value={form.eventDate}
              onChange={(e) =>
                setForm((f) => ({ ...f, eventDate: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Nama</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
              placeholder="Nama tokoh / atlet"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Jabatan / judul singkat (opsional)</Label>
            <Input
              value={form.title}
              onChange={(e) =>
                setForm((f) => ({ ...f, title: e.target.value }))
              }
              placeholder={titlePlaceholderForKind(form.kind)}
            />
          </div>
          <div className="sm:col-span-2">
            <SummaryField
              id="create-summary"
              kind={form.kind}
              value={form.summary}
              onChange={(summary) => setForm((f) => ({ ...f, summary }))}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <FileUploadField
              label="Foto (opsional)"
              value={form.photoUrl}
              onChange={(photoUrl) => setForm((f) => ({ ...f, photoUrl }))}
              folder="apresiasi"
              accept="image/*"
            />
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="sm:col-span-2 bg-inkai-red hover:bg-inkai-red/90"
          >
            Tambah Apresiasi
          </Button>
        </form>
      </section>

      <div>
        <p className="mb-3 text-sm font-medium text-muted-foreground">
          Daftar entri
        </p>
        <div className="mb-4 flex flex-wrap gap-2">
          {(
            [
              ["ALL", "Semua"],
              ["KENANGAN", "Kenangan"],
              ["PRESTASI", "Prestasi"],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              size="sm"
              variant={filter === value ? "default" : "outline"}
              className={
                filter === value ? "bg-inkai-red hover:bg-inkai-red/90" : ""
              }
              onClick={() => setFilter(value)}
            >
              {label}
            </Button>
          ))}
        </div>

        <div className="space-y-3">
          {visible.length === 0 ? (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              Belum ada entri. Tambahkan kenangan atau prestasi di formulir di
              atas.
            </p>
          ) : (
            visible.map((item) => {
              const index = items.findIndex((i) => i.id === item.id);
              const isKenangan = item.kind === "KENANGAN";
              return (
                <div
                  key={item.id}
                  className={cn(
                    "flex flex-col gap-3 rounded-xl border p-4 transition-colors sm:flex-row sm:items-center sm:justify-between",
                    isKenangan
                      ? "border-border/80 bg-muted/20"
                      : "border-inkai-red/15 bg-card",
                  )}
                >
                  <div className="flex min-w-0 gap-3">
                    <span
                      className={cn(
                        "mt-1 hidden w-1 shrink-0 rounded-full sm:block",
                        isKenangan
                          ? "bg-foreground/25"
                          : "bg-gradient-to-b from-inkai-red to-inkai-yellow/80",
                      )}
                      aria-hidden
                    />
                    {item.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.photoUrl}
                        alt={item.name}
                        className="h-14 w-14 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <div
                        className={cn(
                          "flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                          isKenangan
                            ? "bg-foreground/10 text-foreground/70"
                            : "bg-inkai-red/10 text-inkai-red",
                        )}
                      >
                        {item.name.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {isKenangan ? "Kenangan" : "Prestasi"}
                        {item.title ? ` · ${item.title}` : ""}
                        {item.eventDate
                          ? ` · ${toDateInput(item.eventDate)}`
                          : ""}
                        {item.isActive ? " · Aktif" : " · Nonaktif"}
                      </p>
                      <p className="mt-1 line-clamp-2 whitespace-pre-line text-sm text-muted-foreground">
                        {item.summary}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={index <= 0}
                      onClick={() => void move(item.id, -1)}
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={index < 0 || index >= items.length - 1}
                      onClick={() => void move(item.id, 1)}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <AdminMoreActions
                      items={[
                        {
                          label: "Ubah",
                          onSelect: () => openEdit(item),
                        },
                        {
                          label: item.isActive ? "Nonaktifkan" : "Aktifkan",
                          onSelect: () =>
                            void toggleActive(item.id, item.isActive),
                        },
                        {
                          label: "Hapus",
                          onSelect: () => void handleDelete(item.id),
                          destructive: true,
                          separatorBefore: true,
                        },
                      ]}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <Dialog
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Ubah apresiasi</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>Jenis</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={editForm.kind}
                onChange={(e) =>
                  setEditForm((f) => ({
                    ...f,
                    kind: e.target.value as AppreciationKind,
                  }))
                }
              >
                <option value="PRESTASI">Prestasi</option>
                <option value="KENANGAN">Kenangan</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Tanggal (opsional)</Label>
              <Input
                type="date"
                value={editForm.eventDate}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, eventDate: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Nama</Label>
              <Input
                value={editForm.name}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, name: e.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Jabatan / judul singkat (opsional)</Label>
              <Input
                value={editForm.title}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, title: e.target.value }))
                }
                placeholder={titlePlaceholderForKind(editForm.kind)}
              />
            </div>
            <SummaryField
              id="edit-summary"
              kind={editForm.kind}
              value={editForm.summary}
              onChange={(summary) => setEditForm((f) => ({ ...f, summary }))}
            />
            <FileUploadField
              label="Foto (opsional)"
              value={editForm.photoUrl}
              onChange={(photoUrl) =>
                setEditForm((f) => ({ ...f, photoUrl }))
              }
              folder="apresiasi"
              accept="image/*"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Batal
            </Button>
            <Button
              className="bg-inkai-red hover:bg-inkai-red/90"
              disabled={savingEdit || !editForm.name.trim() || !editForm.summary.trim()}
              onClick={() => void handleUpdate()}
            >
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
