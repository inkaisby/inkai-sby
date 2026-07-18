"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { showError, showSuccess } from "@/lib/client-toast";
import { FileUploadField } from "@/components/admin/FileUploadField";
import { ArrowDown, ArrowUp } from "lucide-react";

type CarouselItem = {
  id: string;
  title: string;
  imageUrl: string;
  targetUrl: string | null;
  order: number;
  isActive: boolean;
};

export function CarouselManager({
  initialItems,
}: {
  initialItems: CarouselItem[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(
    [...initialItems].sort((a, b) => a.order - b.order),
  );
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
      body: JSON.stringify({
        title,
        imageUrl,
        targetUrl,
        order: items.length,
      }),
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
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, isActive: !isActive } : i)),
      );
      showSuccess(data.message || "Carousel berhasil diperbarui");
    } else {
      showError(data.error || "Gagal memperbarui carousel");
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
        fetch(`/api/admin/carousel/${item.id}`, {
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
    if (!confirm("Hapus item carousel?")) return;
    const res = await fetch(`/api/admin/carousel/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setItems((prev) => prev.filter((i) => i.id !== id));
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
        <div className="space-y-2 sm:col-span-2">
          <FileUploadField
            label="Gambar carousel"
            value={imageUrl}
            onChange={setImageUrl}
            folder="carousel"
            accept="image/*"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>URL Tujuan (opsional)</Label>
          <Input value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} />
        </div>
        <Button
          type="submit"
          disabled={loading || !imageUrl}
          className="sm:col-span-2 bg-inkai-red hover:bg-inkai-red/90"
        >
          Tambah Carousel
        </Button>
      </form>

      <div className="space-y-3">
        {items.map((item, index) => (
          <div
            key={item.id}
            className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.imageUrl}
                alt={item.title}
                className="h-14 w-20 rounded object-cover"
              />
              <div>
                <p className="font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground">
                  Urutan {index + 1}
                  {item.isActive ? " · Aktif" : " · Nonaktif"}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={index === 0}
                onClick={() => void move(item.id, -1)}
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={index === items.length - 1}
                onClick={() => void move(item.id, 1)}
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void toggleActive(item.id, item.isActive)}
              >
                {item.isActive ? "Nonaktifkan" : "Aktifkan"}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => void handleDelete(item.id)}
              >
                Hapus
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
