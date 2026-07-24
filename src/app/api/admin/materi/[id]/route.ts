import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { forbidUnlessAdminPath } from "@/lib/security/admin-path-guard";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

const materialSchema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  fileUrl: z.string().url().optional(),
  category: z.string().trim().max(80).optional().nullable(),
  isPublished: z.boolean().optional(),
});

export async function PATCH(request: Request, context: RouteContext) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  const denied = forbidUnlessAdminPath(
    authResult.user.roles ?? [],
    "/admin/materi",
    authResult.adminDojoGrants,
  );
  if (denied) return denied;

  const { id } = await context.params;
  const parsed = materialSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const item = await prisma.digitalMaterial.update({
    where: { id },
    data: parsed.data,
  });

  return NextResponse.json({ ...item, message: "Materi diperbarui" });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  const denied = forbidUnlessAdminPath(
    authResult.user.roles ?? [],
    "/admin/materi",
    authResult.adminDojoGrants,
  );
  if (denied) return denied;

  const { id } = await context.params;
  await prisma.digitalMaterial.delete({ where: { id } });
  return NextResponse.json({ success: true, message: "Materi dihapus" });
}
