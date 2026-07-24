import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { forbidUnlessAdminPath } from "@/lib/security/admin-path-guard";
import { prisma } from "@/lib/prisma";

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
  const denied = forbidUnlessAdminPath(
    authResult.user.roles ?? [],
    "/admin/carousel",
    authResult.adminDojoGrants,
  );
  if (denied) return denied;

  const items = await prisma.newsCarousel.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
  });
  return NextResponse.json(items);
}

export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  const denied = forbidUnlessAdminPath(
    authResult.user.roles ?? [],
    "/admin/carousel",
    authResult.adminDojoGrants,
  );
  if (denied) return denied;

  const parsed = carouselSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const data = parsed.data;
  const item = await prisma.newsCarousel.create({
    data: {
      title: data.title,
      imageUrl: data.imageUrl,
      targetUrl: data.targetUrl || null,
      order: data.order,
      isActive: data.isActive,
    },
  });

  revalidateTag("news-carousel", "max");
  return NextResponse.json(
    { ...item, message: "Carousel berhasil ditambahkan" },
    { status: 201 },
  );
}
