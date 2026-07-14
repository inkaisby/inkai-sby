import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { inkaiFetch, inkaiErrorMessage } from "@/lib/inkai-api/server";
import { z } from "zod";

const carouselSchema = z.object({
  title: z.string().trim().min(3).max(200),
  imageUrl: z.string().url(),
  targetUrl: z.string().url().optional().or(z.literal("")),
  order: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export async function GET() {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  const { res, data } = await inkaiFetch("/v1/news-carousel", {}, authResult.token);
  if (!res.ok) {
    return NextResponse.json({ error: "Gagal memuat carousel" }, { status: res.status });
  }

  return NextResponse.json((data.data as unknown[]) ?? []);
}

export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!authResult.token) {
    return NextResponse.json({ error: "Token tidak tersedia" }, { status: 401 });
  }

  const parsed = carouselSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const { res, data } = await inkaiFetch(
    "/v1/news-carousel",
    { method: "POST", body: JSON.stringify(parsed.data) },
    authResult.token,
  );

  if (!res.ok) {
    return NextResponse.json(
      { error: inkaiErrorMessage(data, "Gagal menambah carousel") },
      { status: res.status },
    );
  }

  return NextResponse.json(
    { ...(data.data as object), message: "Carousel berhasil ditambahkan" },
    { status: 201 },
  );
}
