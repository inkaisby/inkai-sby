import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { canEditKyuBaru } from "@/lib/belt";
import { beltFeesFromTemplates, BELT_FEE_KEYS } from "@/lib/ukt";
import { uktBeltFeesSchema } from "@/lib/security/schemas";
import { writeAuditLog } from "@/lib/audit";
import { getClientIp } from "@/lib/security/request";

const BELT_LABELS: Record<(typeof BELT_FEE_KEYS)[number], string> = {
  PUTIH: "Putih",
  KUNING: "Kuning",
  HIJAU: "Hijau",
  BIRU: "Biru",
  COKELAT: "Cokelat",
};

export async function GET() {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  const templates = await prisma.rankFeeTemplate.findMany();
  return NextResponse.json({ fees: beltFeesFromTemplates(templates) });
}

export async function PUT(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  if (!canEditKyuBaru(authResult.user.roles)) {
    return NextResponse.json({ error: "Hanya admin cabang yang dapat mengubah biaya sabuk" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = uktBeltFeesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data biaya sabuk tidak valid" }, { status: 400 });
  }

  const fees = parsed.data;

  await prisma.$transaction(
    BELT_FEE_KEYS.map((key) =>
      prisma.rankFeeTemplate.upsert({
        where: { rankName: BELT_LABELS[key] },
        create: { rankName: BELT_LABELS[key], fee: fees[key] },
        update: { fee: fees[key] },
      }),
    ),
  );

  writeAuditLog({
    userId: authResult.user.id,
    email: authResult.user.email,
    action: "UKT_BELT_FEES_UPDATE",
    details: JSON.stringify(fees),
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ success: true, fees });
}
