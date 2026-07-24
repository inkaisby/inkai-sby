import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { AppreciationKind } from "@prisma/client";
import { requireAdmin } from "@/lib/admin-auth";
import { canAccessAdminPath } from "@/lib/admin-page-access";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  kind: z.nativeEnum(AppreciationKind),
  name: z.string().trim().min(2).max(200),
  title: z.string().trim().max(200).optional().nullable(),
  summary: z.string().trim().min(3).max(4000),
  photoUrl: z.string().url().optional().nullable().or(z.literal("")),
  eventDate: z
    .string()
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform((v) => {
      if (!v) return null;
      const d = new Date(v);
      return Number.isFinite(d.getTime()) ? d.toISOString() : null;
    }),
  order: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export async function GET() {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!canAccessAdminPath(authResult.user.roles ?? [], "/admin/apresiasi")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const items = await prisma.appreciationEntry.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
  });
  return NextResponse.json(items);
}

export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!canAccessAdminPath(authResult.user.roles ?? [], "/admin/apresiasi")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const data = parsed.data;
  const item = await prisma.appreciationEntry.create({
    data: {
      kind: data.kind,
      name: data.name,
      title: data.title?.trim() || null,
      summary: data.summary,
      photoUrl: data.photoUrl || null,
      eventDate: data.eventDate ? new Date(data.eventDate) : null,
      order: data.order,
      isActive: data.isActive,
    },
  });

  revalidateTag("appreciations", "max");
  return NextResponse.json(
    { ...item, message: "Apresiasi berhasil ditambahkan" },
    { status: 201 },
  );
}
