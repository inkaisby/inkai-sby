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
import { FileUploadField } from "@/components/admin/FileUploadField";
import { Badge } from "@/components/ui/badge";
import { showError, showSuccess } from "@/lib/client-toast";
import {
  parseArticleMedia,
  articlePublicPath,
  type ArticleMediaItem,
} from "@/lib/articles";
import {
  normalizeSummaryText,
  polishAppreciationSummary,
} from "@/lib/polish-summary";
import { youtubeVideoId } from "@/lib/youtube";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type MemberArticleItem = {
  id: string;
  title: string;
  summary: string;
  photoUrl: string | null;
  media: ArticleMediaItem[];
  status: "DRAFT" | "PENDING" | "PUBLISHED" | "REJECTED";
  rejectReason: string | null;
  publishedAt: string | null;
  updatedAt: string;
};

const STATUS_LABEL: Record<MemberArticleItem["status"], string> = {
  DRAFT: "Draft",
  PENDING: "Menunggu",
  PUBLISHED: "Terbit",
  REJECTED: "Ditolak",
};

type FormFields = {
  title: string;
  summary: string;
  photoUrl: string;
  media: ArticleMediaItem[];
};

const emptyForm = (): FormFields => ({
  title: "",
  summary: "",
  photoUrl: "",
  media: [],
});

function sanitizeMedia(media: ArticleMediaItem[]): ArticleMediaItem[] | null {
  const cleaned = media
    .map((m) => ({
      type: m.type,
      url: m.url.trim(),
      ...(m.caption?.trim() ? { caption: m.caption.trim() } : {}),
    }))
    .filter((m) => {
      if (!m.url) return false;
      if (m.type === "VIDEO") return Boolean(youtubeVideoId(m.url));
      try {
        const u = new URL(m.url);
        return u.protocol === "http:" || u.protocol === "https:";
      } catch {
        return false;
      }
    })
    .slice(0, 20);
  return cleaned.length > 0 ? cleaned : null;
}

export function MemberArtikelManager({
  initialItems,
  hasMemberProfile,
}: {
  initialItems: MemberArticleItem[];
  hasMemberProfile: boolean;
}) {
  const [items, setItems] = useState(initialItems);
  const [form, setForm] = useState<FormFields>(emptyForm);
  const [loading, setLoading] = useState<"draft" | "submit" | null>(null);
  const [editing, setEditing] = useState<MemberArticleItem | null>(null);
  const [editForm, setEditForm] = useState<FormFields>(emptyForm);
  const [savingEdit, setSavingEdit] = useState<"draft" | "submit" | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/member/artikel");
      if (!res.ok) return;
      const data = await res.json();
      setItems(
        data.map(
          (row: MemberArticleItem & { media?: unknown }): MemberArticleItem => ({
            ...row,
            media: parseArticleMedia(row.media),
            status: row.status ?? "DRAFT",
            rejectReason: row.rejectReason ?? null,
            publishedAt: row.publishedAt
              ? typeof row.publishedAt === "string"
                ? row.publishedAt
                : new Date(row.publishedAt).toISOString()
              : null,
            updatedAt:
              typeof row.updatedAt === "string"
                ? row.updatedAt
                : new Date(row.updatedAt).toISOString(),
          }),
        ),
      );
    } catch (err) {
      console.error(err);
    }
  }

  function openEdit(item: MemberArticleItem) {
    setEditing(item);
    setEditForm({
      title: item.title,
      summary: item.summary,
      photoUrl: item.photoUrl ?? "",
      media: item.media ?? [],
    });
  }

  async function handleCreate(intent: "draft" | "submit") {
    if (!hasMemberProfile) {
      showError("Lengkapi profil anggota/ranting dulu sebelum menulis.");
      return;
    }
    setLoading(intent);
    const summary = normalizeSummaryText(form.summary);
    const media = sanitizeMedia(form.media);
    const res = await fetch("/api/member/artikel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        summary,
        photoUrl: form.photoUrl || null,
        media,
        intent,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(null);
    if (res.ok) {
      showSuccess(data.message || "Berhasil disimpan");
      setForm(emptyForm());
      void load();
    } else {
      showError(data.error || "Gagal menyimpan");
    }
  }

  async function handleUpdate(intent: "draft" | "submit") {
    if (!editing) return;
    if (editing.status === "PUBLISHED" && intent === "submit") {
      const ok = confirm(
        "Artikel sudah terbit. Menyimpan perubahan akan menariknya dari publik sampai disetujui lagi. Lanjutkan?",
      );
      if (!ok) return;
    }
    setSavingEdit(intent);
    const summary = normalizeSummaryText(editForm.summary);
    const media = sanitizeMedia(editForm.media);
    const res = await fetch(`/api/member/artikel/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: editForm.title,
        summary,
        photoUrl: editForm.photoUrl || null,
        media,
        intent,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSavingEdit(null);
    if (res.ok) {
      showSuccess(data.message || "Berhasil diperbarui");
      setEditing(null);
      void load();
    } else {
      showError(data.error || "Gagal memperbarui");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Hapus artikel ini?")) return;
    const res = await fetch(`/api/member/artikel/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setItems((prev) => prev.filter((i) => i.id !== id));
      showSuccess(data.message || "Dihapus");
    } else {
      showError(data.error || "Gagal menghapus");
    }
  }

  return (
    <div className="space-y-8">
      {!hasMemberProfile ? (
        <div
          role="status"
          className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm"
        >
          Profil anggota/ranting belum lengkap. Lengkapi profil sebelum mengirim
          artikel.
        </div>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-border/80 bg-card">
        <div className="border-b border-border/60 bg-muted/30 px-4 py-3">
          <p className="text-sm font-medium">Tulis artikel</p>
          <p className="text-xs text-muted-foreground">
            Kirim untuk ditinjau ranting/cabang. Setelah disetujui, tampil di
            /artikel.
          </p>
        </div>
        <form
          className="grid gap-4 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void handleCreate("submit");
          }}
        >
          <div className="space-y-2">
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label htmlFor="member-create-summary">Isi artikel</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-xs"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    summary: polishAppreciationSummary(f.summary),
                  }))
                }
                disabled={!form.summary.trim()}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Rapikan teks
              </Button>
            </div>
            <textarea
              id="member-create-summary"
              className="flex min-h-[160px] w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              value={form.summary}
              onChange={(e) =>
                setForm((f) => ({ ...f, summary: e.target.value }))
              }
              required
              rows={8}
            />
          </div>
          <FileUploadField
            label="Foto utama (opsional)"
            value={form.photoUrl}
            onChange={(photoUrl) => setForm((f) => ({ ...f, photoUrl }))}
            folder="artikel"
            accept="image/*"
          />
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>Media tambahan</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={form.media.length >= 20}
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    media: [...f.media, { type: "IMAGE", url: "", caption: "" }],
                  }))
                }
              >
                <Plus className="h-3.5 w-3.5" />
                Tambah
              </Button>
            </div>
            {form.media.map((item, index) => (
              <div
                key={`c-media-${index}`}
                className="space-y-2 rounded-lg border p-3"
              >
                <div className="flex gap-2">
                  <select
                    className="h-9 rounded-md border px-2 text-sm"
                    value={item.type}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        media: f.media.map((m, i) =>
                          i === index
                            ? {
                                type: e.target.value as "IMAGE" | "VIDEO",
                                url: "",
                                caption: m.caption,
                              }
                            : m,
                        ),
                      }))
                    }
                  >
                    <option value="IMAGE">Foto</option>
                    <option value="VIDEO">YouTube</option>
                  </select>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="ml-auto text-destructive"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        media: f.media.filter((_, i) => i !== index),
                      }))
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {item.type === "IMAGE" ? (
                  <FileUploadField
                    label={`Foto #${index + 1}`}
                    value={item.url}
                    onChange={(url) =>
                      setForm((f) => ({
                        ...f,
                        media: f.media.map((m, i) =>
                          i === index ? { ...m, url } : m,
                        ),
                      }))
                    }
                    folder="artikel"
                    accept="image/*"
                  />
                ) : (
                  <Input
                    value={item.url}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        media: f.media.map((m, i) =>
                          i === index ? { ...m, url: e.target.value } : m,
                        ),
                      }))
                    }
                    placeholder="https://www.youtube.com/watch?v=…"
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!!loading || !form.title.trim() || !form.summary.trim()}
              onClick={() => void handleCreate("draft")}
            >
              {loading === "draft" ? "Menyimpan…" : "Simpan draft"}
            </Button>
            <Button
              type="submit"
              disabled={
                !!loading ||
                !hasMemberProfile ||
                !form.title.trim() ||
                !form.summary.trim()
              }
              className="bg-inkai-red hover:bg-inkai-red/90"
            >
              {loading === "submit" ? "Mengirim…" : "Kirim untuk review"}
            </Button>
          </div>
        </form>
      </section>

      <div>
        <p className="mb-3 text-sm font-medium text-muted-foreground">
          Artikel saya
        </p>
        <div className="space-y-3">
          {items.length === 0 ? (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              Belum ada artikel. Tulis dan kirim dari formulir di atas.
            </p>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-inkai-red/15 bg-card p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          item.status === "PUBLISHED" &&
                            "border-emerald-500/40 text-emerald-700",
                          item.status === "PENDING" &&
                            "border-amber-500/40 text-amber-800",
                          item.status === "REJECTED" &&
                            "border-destructive/40 text-destructive",
                        )}
                      >
                        {STATUS_LABEL[item.status]}
                      </Badge>
                      {item.status === "PENDING" ? (
                        <span className="text-xs text-amber-800">
                          Tautan publik sementara tidak aktif
                        </span>
                      ) : null}
                    </div>
                    <p className="font-medium">{item.title}</p>
                    <p className="mt-1 line-clamp-2 whitespace-pre-line text-sm text-muted-foreground">
                      {item.summary}
                    </p>
                    {item.status === "REJECTED" && item.rejectReason ? (
                      <p className="mt-2 text-xs text-destructive">
                        Alasan tolak: {item.rejectReason}
                      </p>
                    ) : null}
                    {item.status === "PUBLISHED" ? (
                      <a
                        href={articlePublicPath(item)}
                        className="mt-2 inline-block text-xs font-medium text-inkai-red hover:underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Lihat di /artikel →
                      </a>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEdit(item)}
                    >
                      Ubah
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive"
                      onClick={() => void handleDelete(item.id)}
                    >
                      Hapus
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <Dialog
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Ubah artikel</DialogTitle>
          </DialogHeader>
          {editing?.status === "PUBLISHED" ? (
            <p className="text-xs text-amber-800">
              Artikel sudah terbit. Menyimpan perubahan akan menariknya dari
              publik sampai disetujui lagi.
            </p>
          ) : null}
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>Judul</Label>
              <Input
                value={editForm.title}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, title: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label htmlFor="member-edit-summary">Isi artikel</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() =>
                    setEditForm((f) => ({
                      ...f,
                      summary: polishAppreciationSummary(f.summary),
                    }))
                  }
                  disabled={!editForm.summary.trim()}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Rapikan teks
                </Button>
              </div>
              <textarea
                id="member-edit-summary"
                className="flex min-h-[280px] w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                value={editForm.summary}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, summary: e.target.value }))
                }
                rows={14}
              />
            </div>
            <FileUploadField
              label="Foto utama (opsional)"
              value={editForm.photoUrl}
              onChange={(photoUrl) =>
                setEditForm((f) => ({ ...f, photoUrl }))
              }
              folder="artikel"
              accept="image/*"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setEditing(null)}>
              Batal
            </Button>
            <Button
              variant="outline"
              disabled={
                !!savingEdit ||
                !editForm.title.trim() ||
                !editForm.summary.trim()
              }
              onClick={() => void handleUpdate("draft")}
            >
              {savingEdit === "draft" ? "Menyimpan…" : "Simpan draft"}
            </Button>
            <Button
              className="bg-inkai-red hover:bg-inkai-red/90"
              disabled={
                !!savingEdit ||
                !editForm.title.trim() ||
                !editForm.summary.trim()
              }
              onClick={() => void handleUpdate("submit")}
            >
              {savingEdit === "submit" ? "Mengirim…" : "Kirim / ajukan ulang"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
