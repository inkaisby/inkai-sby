import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma, withPrismaFallback } from "@/lib/prisma";
import { forbidUnlessAdminPath } from "@/lib/security/admin-path-guard";
import { z } from "zod";

const materialSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  fileUrl: z.string().url(),
  category: z.string().trim().max(80).optional().or(z.literal("")),
  isPublished: z.boolean().optional(),
});

export async function GET() {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  const denied = forbidUnlessAdminPath(
    authResult.user.roles ?? [],
    "/admin/materi",
    authResult.adminDojoGrants,
  );
  if (denied) return denied;

  const result = await withPrismaFallback(
    "admin-materials",
    () =>
      prisma.digitalMaterial.findMany({
        orderBy: { createdAt: "desc" },
      }),
    [],
  );

  return NextResponse.json({ data: result.data });
}

export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  const denied = forbidUnlessAdminPath(
    authResult.user.roles ?? [],
    "/admin/materi",
    authResult.adminDojoGrants,
  );
  if (denied) return denied;

  const parsed = materialSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const item = await prisma.digitalMaterial.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description || null,
      fileUrl: parsed.data.fileUrl,
      category: parsed.data.category || null,
      isPublished: parsed.data.isPublished ?? true,
    },
  });

  return NextResponse.json(
    { ...item, message: "Materi berhasil ditambahkan" },
    { status: 201 },
  );
}
