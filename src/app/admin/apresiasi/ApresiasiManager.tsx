"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AppreciationKind } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminMoreActions } from "@/components/admin/AdminMoreActions";
import { FileUploadField } from "@/components/admin/FileUploadField";
import { showError, showSuccess } from "@/lib/client-toast";
import { ArrowDown, ArrowUp } from "lucide-react";

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
  const [kind, setKind] = useState<AppreciationKind>("PRESTASI");
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [loading, setLoading] = useState(false);

  const visible = useMemo(
    () => (filter === "ALL" ? items : items.filter((i) => i.kind === filter)),
    [items, filter],
  );

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/admin/apresiasi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind,
        name,
        title: title || null,
        summary,
        photoUrl: photoUrl || null,
        eventDate: eventDate || null,
        order: items.length,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (res.ok) {
      showSuccess(data.message || "Apresiasi berhasil ditambahkan");
      setName("");
      setTitle("");
      setSummary("");
      setPhotoUrl("");
      setEventDate("");
      router.refresh();
    } else {
      showError(data.error || "Gagal menambah apresiasi");
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
      <form
        onSubmit={handleCreate}
        className="grid gap-4 rounded-xl border p-4 sm:grid-cols-2"
      >
        <div className="space-y-2">
          <Label>Jenis</Label>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            value={kind}
            onChange={(e) => setKind(e.target.value as AppreciationKind)}
          >
            <option value="PRESTASI">Prestasi</option>
            <option value="KENANGAN">Kenangan</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label>Tanggal (opsional)</Label>
          <Input
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Nama</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Nama tokoh / atlet"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Jabatan / judul (opsional)</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ketua ranting · Juara 1 kejuaraan …"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Ringkasan</Label>
          <textarea
            className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            required
            rows={3}
            placeholder="Ucapan kenangan atau deskripsi pencapaian"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <FileUploadField
            label="Foto (opsional)"
            value={photoUrl}
            onChange={setPhotoUrl}
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

      <div className="flex flex-wrap gap-2">
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
            className={filter === value ? "bg-inkai-red hover:bg-inkai-red/90" : ""}
            onClick={() => setFilter(value)}
          >
            {label}
          </Button>
        ))}
      </div>

      <div className="space-y-3">
        {visible.length === 0 ? (
          <p className="rounded-xl border p-6 text-center text-sm text-muted-foreground">
            Belum ada entri. Tambahkan kenangan atau prestasi di formulir di atas.
          </p>
        ) : (
          visible.map((item) => {
            const index = items.findIndex((i) => i.id === item.id);
            return (
              <div
                key={item.id}
                className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 gap-3">
                  {item.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.photoUrl}
                      alt={item.name}
                      className="h-14 w-14 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
                      {item.name.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.kind === "KENANGAN" ? "Kenangan" : "Prestasi"}
                      {item.title ? ` · ${item.title}` : ""}
                      {item.eventDate
                        ? ` · ${toDateInput(item.eventDate)}`
                        : ""}
                      {item.isActive ? " · Aktif" : " · Nonaktif"}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
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
                        label: item.isActive ? "Nonaktifkan" : "Aktifkan",
                        onSelect: () => void toggleActive(item.id, item.isActive),
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
  );
}
