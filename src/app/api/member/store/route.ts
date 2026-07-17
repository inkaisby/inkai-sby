import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma, withPrismaFallback } from "@/lib/prisma";
import { z } from "zod";

const orderSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1).max(20).default(1),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

export async function GET() {
  const session = await auth();
  if (!session?.user.memberId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  return NextResponse.json({
    products: products.data,
    orders: orders.data,
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user.memberId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = orderSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const product = await prisma.product.findFirst({
    where: {
      id: parsed.data.productId,
      isActive: true,
    },
  });
  if (!product) {
    return NextResponse.json({ error: "Produk tidak ditemukan" }, { status: 404 });
  }
  if (product.stock < parsed.data.quantity) {
    return NextResponse.json({ error: "Stok tidak mencukupi" }, { status: 400 });
  }

  const total = product.price * parsed.data.quantity;

  const order = await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id: product.id },
      data: { stock: { decrement: parsed.data.quantity } },
    });
    return tx.storeOrder.create({
      data: {
        memberId: session.user.memberId!,
        status: "PENDING",
        note: parsed.data.note || null,
        total,
        items: {
          create: [
            {
              productId: product.id,
              quantity: parsed.data.quantity,
              unitPrice: product.price,
            },
          ],
        },
      },
      include: {
        items: { include: { product: { select: { name: true } } } },
      },
    });
  });

  return NextResponse.json(
    { ...order, message: "Pesanan berhasil dibuat. Pengurus akan mengonfirmasi." },
    { status: 201 },
  );
}
