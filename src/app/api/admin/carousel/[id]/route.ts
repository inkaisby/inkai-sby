import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { writeAuditLog } from "@/lib/audit";
import { z } from "zod";

const carouselUpdateSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  imageUrl: z.string().url().optional(),
  targetUrl: z.string().url().optional().nullable(),
  order: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  const { id } = await context.params;
  const body = await request.json();
  const parsed = carouselUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const item = await prisma.newsCarousel.update({
    where: { id },
    data: parsed.data,
  });

  await writeAuditLog({
    userId: authResult.user.id,
    email: authResult.user.email,
    action: "CAROUSEL_UPDATE",
    details: item.title,
  });

  return NextResponse.json(item);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  const { id } = await context.params;
  await prisma.newsCarousel.delete({ where: { id } });

  await writeAuditLog({
    userId: authResult.user.id,
    email: authResult.user.email,
    action: "CAROUSEL_DELETE",
    details: id,
  });

  return NextResponse.json({ success: true });
}
