"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MemberPageHeader } from "@/components/member/MemberPageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { showError, showSuccess } from "@/lib/client-toast";
import { Loader2, ShoppingBag } from "lucide-react";

type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  imageUrl: string | null;
};

type Order = {
  id: string;
  status: string;
  total: number;
  createdAt: string;
  items: Array<{ quantity: number; product: { name: string } }>;
};

function formatRp(n: number) {
  return `Rp ${Math.round(n).toLocaleString("id-ID")}`;
}

export function StoreClient({
  initial,
}: {
  initial?: { products: Product[]; orders: Order[] } | null;
}) {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>(initial?.products ?? []);
  const [orders, setOrders] = useState<Order[]>(initial?.orders ?? []);
  const [loading, setLoading] = useState(!initial);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/member/store");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showError(data.error || "Gagal memuat store");
        return;
      }
      setProducts(data.products ?? []);
      setOrders(data.orders ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initial) return;
    void load();
  }, [initial]);

  async function orderProduct(productId: string) {
    setBusyId(productId);
    try {
      const res = await fetch("/api/member/store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, quantity: 1 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showError(data.error || "Gagal memesan");
        return;
      }
      showSuccess(data.message || "Pesanan dibuat");
      await load();
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <MemberPageHeader title="Store" />
      <p className="mb-4 text-sm text-muted-foreground">
        Pesan perlengkapan resmi INKAI. Pengurus akan mengonfirmasi pesanan.
      </p>

      {products.length === 0 ? (
        <div className="mb-8 rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Belum ada produk tersedia.
        </div>
      ) : (
        <div className="mb-8 space-y-3">
          {products.map((p) => (
            <div
              key={p.id}
              className="rounded-2xl border border-border/60 bg-card p-4"
            >
              <div className="flex gap-3">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.imageUrl}
                    alt={p.name}
                    className="h-16 w-16 rounded-xl object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-inkai-red/10 text-inkai-red">
                    <ShoppingBag size={22} />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{p.name}</p>
                  {p.description ? (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {p.description}
                    </p>
                  ) : null}
                  <p className="mt-1 text-sm font-bold text-inkai-red">
                    {formatRp(p.price)}
                  </p>
                  <p className="text-xs text-muted-foreground">Stok: {p.stock}</p>
                </div>
              </div>
              <Button
                className="mt-3 w-full bg-inkai-red hover:bg-inkai-red/90"
                disabled={busyId === p.id || p.stock < 1}
                onClick={() => orderProduct(p.id)}
              >
                {busyId === p.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Pesan"
                )}
              </Button>
            </div>
          ))}
        </div>
      )}

      <h3 className="mb-3 text-base font-extrabold">Pesanan Saya</h3>
      {orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Belum ada pesanan.
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((o) => (
            <div
              key={o.id}
              className="rounded-2xl border border-border/60 bg-card p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">
                    {o.items.map((i) => `${i.product.name} ×${i.quantity}`).join(", ")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(o.createdAt).toLocaleString("id-ID")}
                  </p>
                </div>
                <Badge variant="secondary">{o.status}</Badge>
              </div>
              <p className="mt-1 text-sm font-bold">{formatRp(o.total)}</p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
