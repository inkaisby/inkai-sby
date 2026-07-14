"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { showError, showSuccess } from "@/lib/client-toast";

export function CarouselManager({
  initialItems,
}: {
  initialItems: {
    id: string;
    title: string;
    imageUrl: string;
    targetUrl: string | null;
    order: number;
    isActive: boolean;
  }[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/admin/carousel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, imageUrl, targetUrl, order: initialItems.length }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (res.ok) {
      showSuccess(data.message || "Carousel berhasil ditambahkan");
      setTitle("");
      setImageUrl("");
      setTargetUrl("");
      router.refresh();
    } else {
      showError(data.error || "Gagal menambahkan carousel");
    }
  }

  async function toggleActive(id: string, isActive: boolean) {
    const res = await fetch(`/api/admin/carousel/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      showSuccess(data.message || "Carousel berhasil diperbarui");
      router.refresh();
    } else {
      showError(data.error || "Gagal memperbarui carousel");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Hapus item carousel?")) return;
    const res = await fetch(`/api/admin/carousel/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      showSuccess(data.message || "Carousel berhasil dihapus");
      router.refresh();
    } else {
      showError(data.error || "Gagal menghapus carousel");
    }
  }

  return (
    <div className="space-y-8">
      <form onSubmit={handleCreate} className="grid gap-4 rounded-xl border p-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label>Judul</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>URL Gambar</Label>
          <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>URL Tujuan (opsional)</Label>
          <Input value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} />
        </div>
        <Button type="submit" disabled={loading} className="sm:col-span-2 bg-inkai-red hover:bg-inkai-red/90">
          Tambah Carousel
        </Button>
      </form>

      <div className="space-y-3">
        {initialItems.map((item) => (
          <div key={item.id} className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">{item.title}</p>
              <p className="max-w-md truncate text-xs text-muted-foreground">{item.imageUrl}</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => toggleActive(item.id, item.isActive)}>
                {item.isActive ? "Nonaktifkan" : "Aktifkan"}
              </Button>
              <Button size="sm" variant="destructive" onClick={() => handleDelete(item.id)}>
                Hapus
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
