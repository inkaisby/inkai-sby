import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { StoreClient } from "@/components/member/StoreClient";
import { prisma, withPrismaFallback } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function StorePage() {
  const session = await auth();
  if (!session?.user.memberId) redirect("/login");

  const [products, orders] = await Promise.all([
    withPrismaFallback(
      "member-products",
      () =>
        prisma.product.findMany({
          where: { isActive: true, stock: { gt: 0 } },
          orderBy: { name: "asc" },
        }),
      [],
    ),
    withPrismaFallback(
      "member-orders",
      () =>
        prisma.storeOrder.findMany({
          where: { memberId: session.user.memberId! },
          include: {
            items: { include: { product: { select: { name: true } } } },
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        }),
      [],
    ),
  ]);

  return (
    <StoreClient
      initial={{
        products: products.data.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          price: p.price,
          stock: p.stock,
          imageUrl: p.imageUrl,
        })),
        orders: orders.data.map((o) => ({
          id: o.id,
          status: o.status,
          total: o.total,
          createdAt:
            o.createdAt instanceof Date
              ? o.createdAt.toISOString()
              : String(o.createdAt),
          items: o.items.map((it) => ({
            quantity: it.quantity,
            product: { name: it.product.name },
          })),
        })),
      }}
    />
  );
}
