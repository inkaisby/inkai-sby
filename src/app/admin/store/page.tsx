import { Suspense } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { canAccessAdmin } from "@/lib/rbac";
import { prisma, withPrismaFallback } from "@/lib/prisma";
import { StoreManager } from "./StoreManager";
import { AdminPageLoader } from "@/components/ui/AdminPageLoader";

export const dynamic = "force-dynamic";

export default function AdminStorePage() {
  return (
    <Suspense fallback={<AdminPageLoader rows={4} />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const session = await auth();
  if (!session || !canAccessAdmin(session.user)) redirect("/login");

  const [products, orders] = await Promise.all([
    withPrismaFallback(
      "admin-store-products",
      () => prisma.product.findMany({ orderBy: { createdAt: "desc" } }),
      [],
    ),
    withPrismaFallback(
      "admin-store-orders",
      () =>
        prisma.storeOrder.findMany({
          include: {
            member: { select: { fullName: true, nia: true } },
            items: { include: { product: { select: { name: true } } } },
          },
          orderBy: { createdAt: "desc" },
          take: 50,
        }),
      [],
    ),
  ]);

  return (
    <>
      <h2 className="mb-2 text-2xl font-bold">Store</h2>
      <p className="mb-6 text-muted-foreground">
        Kelola produk dan pesanan anggota.
      </p>
      <StoreManager
        initialProducts={products.data}
        initialOrders={orders.data.map((o) => ({
          ...o,
          createdAt: o.createdAt.toISOString(),
        }))}
      />
    </>
  );
}
