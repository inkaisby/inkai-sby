"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { showError, showSuccess } from "@/lib/client-toast";
import { Loader2, Plus } from "lucide-react";

type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  imageUrl: string | null;
  isActive: boolean;
};

type Order = {
  id: string;
  status: string;
  total: number;
  createdAt: string;
  member: { fullName: string; nia: string | null };
  items: Array<{ quantity: number; product: { name: string } }>;
};

export function StoreManager({
  initialProducts,
  initialOrders,
}: {
  initialProducts: Product[];
  initialOrders: Order[];
}) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);
  const [orders, setOrders] = useState(initialOrders);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("50000");
  const [stock, setStock] = useState("10");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [busy, setBusy] = useState(false);

  async function addProduct() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          price: Number(price),
          stock: Number(stock),
          description,
          imageUrl,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showError(data.error || "Gagal menambah produk");
        return;
      }
      showSuccess(data.message || "Produk ditambahkan");
      setProducts((p) => [data as Product, ...p]);
      setName("");
      setDescription("");
      setImageUrl("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function setOrderStatus(id: string, status: string) {
    const res = await fetch(`/api/admin/store/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "order", status }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showError(data.error || "Gagal update status");
      return;
    }
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status } : o)),
    );
    showSuccess("Status diperbarui");
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <section>
        <h3 className="mb-3 text-lg font-semibold">Tambah Produk</h3>
        <div className="grid gap-2 rounded-xl border p-4 md:grid-cols-2">
          <Input placeholder="Nama produk" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Harga" type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
          <Input placeholder="Stok" type="number" value={stock} onChange={(e) => setStock(e.target.value)} />
          <Input placeholder="URL gambar (opsional)" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
          <Input
            className="md:col-span-2"
            placeholder="Deskripsi"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <Button
            className="bg-inkai-red hover:bg-inkai-red/90 md:col-span-2"
            disabled={busy || !name}
            onClick={() => void addProduct()}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="mr-1 h-4 w-4" /> Tambah</>}
          </Button>
        </div>

        <div className="mt-4 space-y-2">
          {products.map((p) => (
            <div key={p.id} className="flex justify-between gap-2 rounded-xl border p-3">
              <div>
                <p className="font-medium">{p.name}</p>
                <p className="text-sm text-muted-foreground">
                  Rp {Math.round(p.price).toLocaleString("id-ID")} · stok {p.stock}
                </p>
              </div>
              <Badge variant={p.isActive ? "default" : "secondary"}>
                {p.isActive ? "Aktif" : "Nonaktif"}
              </Badge>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-lg font-semibold">Pesanan</h3>
        {orders.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada pesanan.</p>
        ) : (
          <div className="space-y-2">
            {orders.map((o) => (
              <div key={o.id} className="rounded-xl border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{o.member.fullName}</p>
                    <p className="text-sm text-muted-foreground">
                      {o.items.map((i) => `${i.product.name} ×${i.quantity}`).join(", ")}
                    </p>
                    <p className="text-sm font-semibold">
                      Rp {Math.round(o.total).toLocaleString("id-ID")}
                    </p>
                  </div>
                  <Badge variant="secondary">{o.status}</Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {["CONFIRMED", "DONE", "CANCELLED"].map((s) => (
                    <Button
                      key={s}
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => void setOrderStatus(o.id, s)}
                    >
                      {s}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
