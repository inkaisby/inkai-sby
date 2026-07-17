import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma, withPrismaFallback } from "@/lib/prisma";
import { z } from "zod";

const productSchema = z.object({
  name: z.string().trim().min(2).max(200),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  price: z.coerce.number().min(0),
  stock: z.coerce.number().int().min(0).default(0),
  imageUrl: z.string().url().optional().or(z.literal("")),
  isActive: z.boolean().optional(),
});

export async function GET() {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  const [products, orders] = await Promise.all([
    withPrismaFallback(
      "admin-products",
      () => prisma.product.findMany({ orderBy: { createdAt: "desc" } }),
      [],
    ),
    withPrismaFallback(
      "admin-orders",
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

  return NextResponse.json({
    products: products.data,
    orders: orders.data,
  });
}

export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  const parsed = productSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const item = await prisma.product.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description || null,
      price: parsed.data.price,
      stock: parsed.data.stock,
      imageUrl: parsed.data.imageUrl || null,
      isActive: parsed.data.isActive ?? true,
    },
  });

  return NextResponse.json(
    { ...item, message: "Produk berhasil ditambahkan" },
    { status: 201 },
  );
}
