"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AdminMoreActions } from "@/components/admin/AdminMoreActions";
import { showError, showSuccess } from "@/lib/client-toast";
import { FileUploadField } from "@/components/admin/FileUploadField";
import { Loader2, Plus } from "lucide-react";

type Material = {
  id: string;
  title: string;
  description: string | null;
  fileUrl: string;
  category: string | null;
  isPublished: boolean;
};

export function MateriManager({ initialItems }: { initialItems: Material[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [category, setCategory] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/materi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, fileUrl, category }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showError(data.error || "Gagal menambah");
        return;
      }
      showSuccess(data.message || "Ditambahkan");
      setTitle("");
      setDescription("");
      setFileUrl("");
      setCategory("");
      setItems((prev) => [data as Material, ...prev]);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function togglePublish(m: Material) {
    const res = await fetch(`/api/admin/materi/${m.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublished: !m.isPublished }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showError(data.error || "Gagal memperbarui");
      return;
    }
    setItems((prev) =>
      prev.map((i) =>
        i.id === m.id ? { ...i, isPublished: !m.isPublished } : i,
      ),
    );
    showSuccess(m.isPublished ? "Materi disembunyikan" : "Materi dipublikasikan");
  }

  async function remove(id: string) {
    if (!confirm("Hapus materi ini?")) return;
    const res = await fetch(`/api/admin/materi/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showError(data.error || "Gagal menghapus");
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
    showSuccess("Dihapus");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-2 rounded-xl border p-4 md:grid-cols-2">
        <Input placeholder="Judul" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Input placeholder="Kategori (opsional)" value={category} onChange={(e) => setCategory(e.target.value)} />
        <div className="md:col-span-2">
          <FileUploadField
            label="File materi (PDF/gambar)"
            value={fileUrl}
            onChange={setFileUrl}
            folder="materi"
            accept="image/*,application/pdf"
          />
        </div>
        <Input
          className="md:col-span-2"
          placeholder="Deskripsi (opsional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <Button
          className="bg-inkai-red hover:bg-inkai-red/90 md:col-span-2"
          disabled={busy || !title || !fileUrl}
          onClick={() => void add()}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="mr-1 h-4 w-4" /> Tambah Materi</>}
        </Button>
      </div>

      <div className="space-y-2">
        {items.map((m) => (
          <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{m.title}</p>
                <Badge variant={m.isPublished ? "default" : "outline"}>
                  {m.isPublished ? "Publik" : "Draft"}
                </Badge>
                {m.category ? (
                  <Badge variant="secondary">{m.category}</Badge>
                ) : null}
              </div>
              <a href={m.fileUrl} target="_blank" rel="noreferrer" className="text-xs text-inkai-red hover:underline">
                Buka file
              </a>
            </div>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="outline" onClick={() => void togglePublish(m)}>
                {m.isPublished ? "Sembunyikan" : "Publikasikan"}
              </Button>
              <AdminMoreActions
                items={[
                  {
                    label: "Hapus",
                    onSelect: () => void remove(m.id),
                    destructive: true,
                  },
                ]}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
