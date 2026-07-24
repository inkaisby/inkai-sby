import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { AppreciationKind } from "@prisma/client";
import { requireAdmin } from "@/lib/admin-auth";
import { canAccessAdminPath } from "@/lib/admin-page-access";
import { polishAppreciationSummary } from "@/lib/polish-summary";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  kind: z.nativeEnum(AppreciationKind).optional(),
  name: z.string().trim().min(2).max(200).optional(),
  title: z.string().trim().max(200).optional().nullable(),
  summary: z.string().trim().min(3).max(4000).optional(),
  photoUrl: z.string().url().optional().nullable().or(z.literal("")),
  eventDate: z
    .string()
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform((v) => {
      if (v === undefined) return undefined;
      if (!v) return null;
      const d = new Date(v);
      return Number.isFinite(d.getTime()) ? d.toISOString() : null;
    }),
  order: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!canAccessAdminPath(authResult.user.roles ?? [], "/admin/apresiasi")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const d = parsed.data;
  let polishedSummary: string | undefined;
  if (d.summary !== undefined) {
    polishedSummary = polishAppreciationSummary(d.summary);
    if (polishedSummary.length < 3 || polishedSummary.length > 4000) {
      return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
    }
  }
  try {
    const item = await prisma.appreciationEntry.update({
      where: { id },
      data: {
        ...(d.kind !== undefined ? { kind: d.kind } : {}),
        ...(d.name !== undefined ? { name: d.name } : {}),
        ...(d.title !== undefined ? { title: d.title?.trim() || null } : {}),
        ...(polishedSummary !== undefined ? { summary: polishedSummary } : {}),
        ...(d.photoUrl !== undefined ? { photoUrl: d.photoUrl || null } : {}),
        ...(d.eventDate !== undefined
          ? { eventDate: d.eventDate ? new Date(d.eventDate) : null }
          : {}),
        ...(d.order !== undefined ? { order: d.order } : {}),
        ...(d.isActive !== undefined ? { isActive: d.isActive } : {}),
      },
    });
    revalidateTag("appreciations", "max");
    return NextResponse.json({
      ...item,
      message: "Apresiasi berhasil diperbarui",
    });
  } catch {
    return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!canAccessAdminPath(authResult.user.roles ?? [], "/admin/apresiasi")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  try {
    await prisma.appreciationEntry.delete({ where: { id } });
    revalidateTag("appreciations", "max");
    return NextResponse.json({ message: "Apresiasi berhasil dihapus" });
  } catch {
    return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });
  }
}
