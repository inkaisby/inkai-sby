import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { writeAuditLog } from "@/lib/audit";
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

  const items = await prisma.newsCarousel.findMany({
    orderBy: { order: "asc" },
  });

  return NextResponse.json(items);
}

export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  const body = await request.json();
  const parsed = carouselSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const item = await prisma.newsCarousel.create({ data: parsed.data });

  await writeAuditLog({
    userId: authResult.user.id,
    email: authResult.user.email,
    action: "CAROUSEL_CREATE",
    details: item.title,
  });

  return NextResponse.json(item, { status: 201 });
}
