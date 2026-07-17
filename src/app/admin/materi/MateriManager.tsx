"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { showError, showSuccess } from "@/lib/client-toast";
import { Loader2, Plus, Trash2 } from "lucide-react";

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
        <Input
          className="md:col-span-2"
          placeholder="URL file (PDF/gambar)"
          value={fileUrl}
          onChange={(e) => setFileUrl(e.target.value)}
        />
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
              <p className="font-medium">{m.title}</p>
              <a href={m.fileUrl} target="_blank" rel="noreferrer" className="text-xs text-inkai-red hover:underline">
                Buka file
              </a>
            </div>
            <Button size="sm" variant="destructive" onClick={() => void remove(m.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
