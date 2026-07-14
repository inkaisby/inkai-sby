import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { canEditKyuBaru } from "@/lib/belt";
import {
  beltFeesFromTemplates,
  BELT_FEE_KEYS,
  DEFAULT_KOMISI_RANTING,
  UKT_KOMISI_SETTING_KEY,
} from "@/lib/ukt";
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

async function loadKomisiRanting(): Promise<number> {
  const setting = await prisma.appSetting.findUnique({
    where: { key: UKT_KOMISI_SETTING_KEY },
  });
  const value = setting?.value;
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value === "object" && value && "amount" in value) {
    const amount = (value as { amount: unknown }).amount;
    if (typeof amount === "number" && Number.isFinite(amount)) return Math.round(amount);
  }
  return DEFAULT_KOMISI_RANTING;
}

export async function GET() {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  const [templates, komisiRanting] = await Promise.all([
    prisma.rankFeeTemplate.findMany(),
    loadKomisiRanting(),
  ]);

  return NextResponse.json({ fees: beltFeesFromTemplates(templates), komisiRanting });
}

export async function PUT(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  if (!canEditKyuBaru(authResult.user.roles)) {
    return NextResponse.json({ error: "Hanya admin cabang yang dapat mengubah pengaturan UKT" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = uktBeltFeesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data pengaturan UKT tidak valid" }, { status: 400 });
  }

  const { komisiRanting, ...fees } = parsed.data;

  await prisma.$transaction([
    ...BELT_FEE_KEYS.map((key) =>
      prisma.rankFeeTemplate.upsert({
        where: { rankName: BELT_LABELS[key] },
        create: { rankName: BELT_LABELS[key], fee: fees[key] },
        update: { fee: fees[key] },
      }),
    ),
    prisma.appSetting.upsert({
      where: { key: UKT_KOMISI_SETTING_KEY },
      create: { key: UKT_KOMISI_SETTING_KEY, value: komisiRanting },
      update: { value: komisiRanting },
    }),
  ]);

  writeAuditLog({
    userId: authResult.user.id,
    email: authResult.user.email,
    action: "UKT_SETTINGS_UPDATE",
    details: JSON.stringify({ fees, komisiRanting }),
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ success: true, fees, komisiRanting });
}
