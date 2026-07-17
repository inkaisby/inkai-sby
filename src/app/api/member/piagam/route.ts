import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const piagamSchema = z.object({
  title: z.string().trim().min(3).max(200),
  eventDate: z.string().optional().or(z.literal("")),
  proofUrl: z.string().url(),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export async function GET() {
  const session = await auth();
  if (!session?.user.memberId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await prisma.verification.findMany({
    where: {
      memberId: session.user.memberId,
      type: "ACHIEVEMENT",
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ data: rows });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user.memberId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = piagamSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const created = await prisma.verification.create({
    data: {
      memberId: session.user.memberId,
      type: "ACHIEVEMENT",
      data: JSON.stringify({
        title: parsed.data.title,
        eventDate: parsed.data.eventDate || null,
        notes: parsed.data.notes || null,
        requestedAt: new Date().toISOString(),
      }),
      proofUrl: parsed.data.proofUrl,
      status: "PENDING",
    },
  });

  return NextResponse.json({
    ...created,
    message: "Piagam terkirim. Menunggu verifikasi pengurus.",
  });
}
