import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { canAccessAdminPath } from "@/lib/admin-page-access";
import { polishAppreciationSummary } from "@/lib/polish-summary";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  title: z.string().trim().min(2).max(200),
  summary: z.string().trim().min(3).max(4000),
  photoUrl: z.string().url().optional().nullable().or(z.literal("")),
  publishedAt: z
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
  if (!canAccessAdminPath(authResult.user.roles ?? [], "/admin/artikel")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const items = await prisma.articleEntry.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    take: 200,
  });
  return NextResponse.json(items);
}

export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!canAccessAdminPath(authResult.user.roles ?? [], "/admin/artikel")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const data = parsed.data;
  const summary = polishAppreciationSummary(data.summary);
  if (summary.length < 3 || summary.length > 4000) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }
  const item = await prisma.articleEntry.create({
    data: {
      title: data.title,
      summary,
      photoUrl: data.photoUrl || null,
      publishedAt: data.publishedAt ? new Date(data.publishedAt) : null,
      order: data.order,
      isActive: data.isActive,
    },
  });

  revalidateTag("articles", "max");
  return NextResponse.json(
    { ...item, message: "Artikel berhasil ditambahkan" },
    { status: 201 },
  );
}
