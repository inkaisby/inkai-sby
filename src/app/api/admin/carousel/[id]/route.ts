import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { inkaiFetch, inkaiErrorMessage } from "@/lib/inkai-api/server";
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
  if (!authResult.token) {
    return NextResponse.json({ error: "Token tidak tersedia" }, { status: 401 });
  }

  const { id } = await context.params;
  const parsed = carouselUpdateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const { res, data } = await inkaiFetch(
    `/v1/news-carousel/${id}`,
    { method: "PUT", body: JSON.stringify(parsed.data) },
    authResult.token,
  );

  if (!res.ok) {
    return NextResponse.json(
      { error: inkaiErrorMessage(data, "Gagal memperbarui carousel") },
      { status: res.status },
    );
  }

  return NextResponse.json({
    ...(data.data as object),
    message: "Carousel berhasil diperbarui",
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!authResult.token) {
    return NextResponse.json({ error: "Token tidak tersedia" }, { status: 401 });
  }

  const { id } = await context.params;
  const { res, data } = await inkaiFetch(
    `/v1/news-carousel/${id}`,
    { method: "DELETE" },
    authResult.token,
  );

  if (!res.ok) {
    return NextResponse.json(
      { error: inkaiErrorMessage(data, "Gagal menghapus carousel") },
      { status: res.status },
    );
  }

  return NextResponse.json({ success: true, message: "Carousel berhasil dihapus" });
}
