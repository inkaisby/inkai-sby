import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { forbidUnlessAdminPath } from "@/lib/security/admin-path-guard";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

const productSchema = z.object({
  name: z.string().trim().min(2).max(200).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  price: z.coerce.number().min(0).optional(),
  stock: z.coerce.number().int().min(0).optional(),
  imageUrl: z.string().url().optional().nullable().or(z.literal("")),
  isActive: z.boolean().optional(),
});

const orderStatusSchema = z.object({
  status: z.enum(["PENDING", "CONFIRMED", "DONE", "CANCELLED"]),
});

export async function PATCH(request: Request, context: RouteContext) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  const denied = forbidUnlessAdminPath(
    authResult.user.roles ?? [],
    "/admin/store",
    authResult.adminDojoGrants,
  );
  if (denied) return denied;

  const { id } = await context.params;
  const body = await request.json();

  if (body?.kind === "order") {
    const parsed = orderStatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
    }
    const order = await prisma.storeOrder.update({
      where: { id },
      data: { status: parsed.data.status },
    });
    return NextResponse.json({ ...order, message: "Status pesanan diperbarui" });
  }

  const parsed = productSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const data = {
    ...parsed.data,
    imageUrl:
      parsed.data.imageUrl === "" ? null : parsed.data.imageUrl,
  };

  const item = await prisma.product.update({ where: { id }, data });
  return NextResponse.json({ ...item, message: "Produk diperbarui" });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  const denied = forbidUnlessAdminPath(
    authResult.user.roles ?? [],
    "/admin/store",
    authResult.adminDojoGrants,
  );
  if (denied) return denied;

  const { id } = await context.params;
  await prisma.product.delete({ where: { id } });
  return NextResponse.json({ success: true, message: "Produk dihapus" });
}
