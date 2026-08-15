"use client";

import { useState } from "react";
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
import { articlePublicPath } from "@/lib/articles";
import { polishAppreciationSummary } from "@/lib/polish-summary";
import { ArrowDown, ArrowUp, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export type ArticleAdminItem = {
  id: string;
  title: string;
  summary: string;
  photoUrl: string | null;
  publishedAt: string | null;
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
  title: string;
  summary: string;
  photoUrl: string;
  publishedAt: string;
};

const emptyForm = (): FormFields => ({
  title: "",
  summary: "",
  photoUrl: "",
  publishedAt: "",
});

function SummaryField({
  value,
  onChange,
  id,
}: {
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
        placeholder="Ringkasan berita atau kegiatan (boleh beberapa paragraf)."
      />
      <p className="text-xs text-muted-foreground">
        Teks tampil di /artikel dan cuplikan beranda. Rapikan teks merapikan
        spasi dan kapitalisasi.
      </p>
    </div>
  );
}

function ArticleThumb({
  title,
  photoUrl,
}: {
  title: string;
  photoUrl: string | null;
}) {
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt={title}
        className="h-16 w-28 shrink-0 rounded-lg object-cover"
      />
    );
  }
  return (
    <div className="flex h-16 w-28 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-inkai-red/15 to-inkai-yellow/15 text-sm font-semibold text-inkai-red">
      {title.slice(0, 1).toUpperCase() || "A"}
    </div>
  );
}

export function ArtikelManager({
  initialItems,
}: {
  initialItems: ArticleAdminItem[];
}) {
  const [items, setItems] = useState(
    [...initialItems].sort((a, b) => a.order - b.order),
  );
  const [form, setForm] = useState<FormFields>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<ArticleAdminItem | null>(null);
  const [editForm, setEditForm] = useState<FormFields>(emptyForm);
  const [savingEdit, setSavingEdit] = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/admin/artikel");
      if (res.ok) {
        const data = await res.json();
        setItems(
          data.sort(
            (a: { order: number }, b: { order: number }) => a.order - b.order,
          ),
        );
      }
    } catch (err) {
      console.error(err);
    }
  }

  function openEdit(item: ArticleAdminItem) {
    setEditing(item);
    setEditForm({
      title: item.title,
      summary: item.summary,
      photoUrl: item.photoUrl ?? "",
      publishedAt: toDateInput(item.publishedAt),
    });
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const summary = polishAppreciationSummary(form.summary);
    const res = await fetch("/api/admin/artikel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        summary,
        photoUrl: form.photoUrl || null,
        publishedAt: form.publishedAt || null,
        order: items.length,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (res.ok) {
      showSuccess(data.message || "Artikel berhasil ditambahkan");
      setForm(emptyForm());
      void load();
    } else {
      showError(data.error || "Gagal menambah artikel");
    }
  }

  async function handleUpdate() {
    if (!editing) return;
    setSavingEdit(true);
    const summary = polishAppreciationSummary(editForm.summary);
    const res = await fetch(`/api/admin/artikel/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: editForm.title,
        summary,
        photoUrl: editForm.photoUrl || null,
        publishedAt: editForm.publishedAt || null,
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
                title: editForm.title,
                summary,
                photoUrl: editForm.photoUrl || null,
                publishedAt: editForm.publishedAt
                  ? new Date(editForm.publishedAt).toISOString()
                  : null,
              }
            : i,
        ),
      );
      showSuccess(data.message || "Artikel berhasil diperbarui");
      setEditing(null);
      void load();
    } else {
      showError(data.error || "Gagal memperbarui");
    }
  }

  async function toggleActive(id: string, isActive: boolean) {
    const res = await fetch(`/api/admin/artikel/${id}`, {
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
        fetch(`/api/admin/artikel/${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order: item.order }),
        }),
      ),
    );
    showSuccess("Urutan diperbarui");
    void load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Hapus artikel ini?")) return;
    const res = await fetch(`/api/admin/artikel/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setItems((prev) => prev.filter((i) => i.id !== id));
      showSuccess(data.message || "Berhasil dihapus");
      void load();
    } else {
      showError(data.error || "Gagal menghapus");
    }
  }

  async function copyPublicLink(item: ArticleAdminItem) {
    try {
      const url = `${window.location.origin}${articlePublicPath(item)}`;
      await navigator.clipboard.writeText(url);
      showSuccess("Tautan publik disalin");
    } catch {
      showError("Gagal menyalin tautan");
    }
  }

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-xl border border-border/80 bg-card">
        <div className="border-b border-border/60 bg-muted/30 px-4 py-3">
          <p className="text-sm font-medium">Tambah artikel</p>
          <p className="text-xs text-muted-foreground">
            Judul singkat; narasi berparagraf di ringkasan. Foto landscape
            disarankan.
          </p>
        </div>
        <form
          onSubmit={handleCreate}
          className="grid gap-4 p-4 sm:grid-cols-2"
        >
          <div className="space-y-2 sm:col-span-2">
            <Label>Judul</Label>
            <Input
              value={form.title}
              onChange={(e) =>
                setForm((f) => ({ ...f, title: e.target.value }))
              }
              required
              placeholder="Judul berita atau kegiatan"
            />
          </div>
          <div className="space-y-2">
            <Label>Tanggal terbit (opsional)</Label>
            <Input
              type="date"
              value={form.publishedAt}
              onChange={(e) =>
                setForm((f) => ({ ...f, publishedAt: e.target.value }))
              }
            />
          </div>
          <div className="sm:col-span-2">
            <SummaryField
              id="create-summary"
              value={form.summary}
              onChange={(summary) => setForm((f) => ({ ...f, summary }))}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <FileUploadField
              label="Foto (opsional)"
              value={form.photoUrl}
              onChange={(photoUrl) => setForm((f) => ({ ...f, photoUrl }))}
              folder="artikel"
              accept="image/*"
            />
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="sm:col-span-2 bg-inkai-red hover:bg-inkai-red/90"
          >
            Tambah Artikel
          </Button>
        </form>
      </section>

      <div>
        <p className="mb-3 text-sm font-medium text-muted-foreground">
          Daftar artikel
        </p>

        <div className="space-y-3">
          {items.length === 0 ? (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              Belum ada artikel. Tambahkan berita atau kegiatan di formulir di
              atas.
            </p>
          ) : (
            items.map((item) => {
              const index = items.findIndex((i) => i.id === item.id);
              return (
                <div
                  key={item.id}
                  className={cn(
                    "flex flex-col gap-3 rounded-xl border p-4 transition-colors sm:flex-row sm:items-center sm:justify-between",
                    "border-inkai-red/15 bg-card",
                  )}
                >
                  <div className="flex min-w-0 gap-3">
                    <span
                      className="mt-1 hidden w-1 shrink-0 rounded-full bg-gradient-to-b from-inkai-red to-inkai-yellow/80 sm:block"
                      aria-hidden
                    />
                    <ArticleThumb title={item.title} photoUrl={item.photoUrl} />
                    <div className="min-w-0">
                      <p className="font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.publishedAt
                          ? toDateInput(item.publishedAt)
                          : "Tanpa tanggal"}
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
                          label: "Salin tautan",
                          onSelect: () => void copyPublicLink(item),
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
            <DialogTitle>Ubah artikel</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>Judul</Label>
              <Input
                value={editForm.title}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, title: e.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Tanggal terbit (opsional)</Label>
              <Input
                type="date"
                value={editForm.publishedAt}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, publishedAt: e.target.value }))
                }
              />
            </div>
            <SummaryField
              id="edit-summary"
              value={editForm.summary}
              onChange={(summary) => setEditForm((f) => ({ ...f, summary }))}
            />
            <FileUploadField
              label="Foto (opsional)"
              value={editForm.photoUrl}
              onChange={(photoUrl) =>
                setEditForm((f) => ({ ...f, photoUrl }))
              }
              folder="artikel"
              accept="image/*"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Batal
            </Button>
            <Button
              className="bg-inkai-red hover:bg-inkai-red/90"
              disabled={
                savingEdit ||
                !editForm.title.trim() ||
                !editForm.summary.trim()
              }
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
