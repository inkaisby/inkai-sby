import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { forbidUnlessAdminPath } from "@/lib/security/admin-path-guard";
import { prisma } from "@/lib/prisma";

const carouselUpdateSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  imageUrl: z.string().url().optional(),
  targetUrl: z.string().url().optional().nullable().or(z.literal("")),
  order: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  const denied = forbidUnlessAdminPath(
    authResult.user.roles ?? [],
    "/admin/carousel",
    authResult.adminDojoGrants,
  );
  if (denied) return denied;

  const { id } = await context.params;
  const parsed = carouselUpdateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const d = parsed.data;
  try {
    const item = await prisma.newsCarousel.update({
      where: { id },
      data: {
        ...(d.title !== undefined ? { title: d.title } : {}),
        ...(d.imageUrl !== undefined ? { imageUrl: d.imageUrl } : {}),
        ...(d.targetUrl !== undefined
          ? { targetUrl: d.targetUrl || null }
          : {}),
        ...(d.order !== undefined ? { order: d.order } : {}),
        ...(d.isActive !== undefined ? { isActive: d.isActive } : {}),
      },
    });
    revalidateTag("news-carousel", "max");
    return NextResponse.json({
      ...item,
      message: "Carousel berhasil diperbarui",
    });
  } catch {
    return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  const denied = forbidUnlessAdminPath(
    authResult.user.roles ?? [],
    "/admin/carousel",
    authResult.adminDojoGrants,
  );
  if (denied) return denied;

  const { id } = await context.params;
  try {
    await prisma.newsCarousel.delete({ where: { id } });
    revalidateTag("news-carousel", "max");
    return NextResponse.json({
      success: true,
      message: "Carousel berhasil dihapus",
    });
  } catch {
    return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });
  }
}
