import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const transferSchema = z.object({
  targetDojoId: z.string().uuid(),
  reason: z.string().trim().min(5).max(500),
  proofUrl: z.string().url().optional().or(z.literal("")),
});

export async function GET() {
  const session = await auth();
  if (!session?.user.memberId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await prisma.verification.findMany({
    where: {
      memberId: session.user.memberId,
      type: { in: ["DOJO_TRANSFER", "TRANSFER"] },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return NextResponse.json({ data: rows });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user.memberId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = transferSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const member = await prisma.member.findUnique({
    where: { id: session.user.memberId },
    include: { dojo: { select: { id: true, name: true } } },
  });
  if (!member) {
    return NextResponse.json({ error: "Anggota tidak ditemukan" }, { status: 404 });
  }

  if (member.dojoId === parsed.data.targetDojoId) {
    return NextResponse.json(
      { error: "Dojo tujuan sama dengan dojo saat ini" },
      { status: 400 },
    );
  }

  const target = await prisma.dojo.findFirst({
    where: { id: parsed.data.targetDojoId, isDeleted: false },
  });
  if (!target) {
    return NextResponse.json({ error: "Dojo tujuan tidak ditemukan" }, { status: 404 });
  }

  const pending = await prisma.verification.findFirst({
    where: {
      memberId: member.id,
      type: { in: ["DOJO_TRANSFER", "TRANSFER"] },
      status: "PENDING",
    },
  });
  if (pending) {
    return NextResponse.json(
      { error: "Masih ada pengajuan pindah dojo yang menunggu verifikasi" },
      { status: 400 },
    );
  }

  const created = await prisma.verification.create({
    data: {
      memberId: member.id,
      type: "DOJO_TRANSFER",
      data: JSON.stringify({
        fromDojoId: member.dojoId,
        fromDojoName: member.dojo.name,
        targetDojoId: target.id,
        targetDojoName: target.name,
        reason: parsed.data.reason,
        requestedAt: new Date().toISOString(),
      }),
      proofUrl: parsed.data.proofUrl || "—",
      status: "PENDING",
    },
  });

  return NextResponse.json({
    ...created,
    message: "Pengajuan pindah dojo terkirim. Menunggu verifikasi pengurus.",
  });
}
