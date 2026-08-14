import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { writeAuditLog } from "@/lib/audit";
import { canEditKyuBaru } from "@/lib/belt";
import { prisma } from "@/lib/prisma";
import { uktTtdTemplateSchema } from "@/lib/security/schemas";
import { getClientIp } from "@/lib/security/request";
import { rateLimitAsync, rateLimitResponse } from "@/lib/security/rate-limit";
import {
  parseUktTtdTemplateValue,
  UKT_TTD_TEMPLATE_KEY,
  type UktTtdTemplate,
} from "@/lib/ukt-ttd";

export async function GET() {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!canEditKyuBaru(authResult.user.roles)) {
    return NextResponse.json(
      { error: "Hanya admin cabang yang dapat membaca template TTD" },
      { status: 403 },
    );
  }

  const row = await prisma.appSetting.findUnique({
    where: { key: UKT_TTD_TEMPLATE_KEY },
  });
  const template = parseUktTtdTemplateValue(row?.value ?? null);
  return NextResponse.json({ success: true, data: template });
}

export async function PATCH(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!canEditKyuBaru(authResult.user.roles)) {
    return NextResponse.json(
      { error: "Hanya admin cabang yang dapat menyimpan template TTD" },
      { status: 403 },
    );
  }

  const rlKey = `ukt:ttd-template:${authResult.user.id}`;
  const limited = await rateLimitAsync(rlKey, { max: 20, windowMs: 60_000 });
  if (!limited.success) {
    return rateLimitResponse(limited.retryAfterSec ?? 60, rlKey);
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const parsed = uktTtdTemplateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data template tidak valid" }, { status: 400 });
  }

  const d = parsed.data;
  const next: UktTtdTemplate = {
    pengdaKetua: d.pengdaKetua?.trim() || undefined,
    pengdaKetuaTitle: d.pengdaKetuaTitle?.trim() || undefined,
    mshKetua: d.mshKetua?.trim() || undefined,
    mshKetuaTitle: d.mshKetuaTitle?.trim() || undefined,
    ketuaCabangName: d.ketuaCabangName?.trim() || undefined,
    bidangUjianName: d.bidangUjianName?.trim() || undefined,
    pengujiNames: d.pengujiNames
      ? d.pengujiNames.map((n) => n.trim()).filter(Boolean).slice(0, 20)
      : undefined,
    pengdaKetuaSignUrl: d.pengdaKetuaSignUrl?.trim() || undefined,
    mshKetuaSignUrl: d.mshKetuaSignUrl?.trim() || undefined,
    ketuaCabangSignUrl: d.ketuaCabangSignUrl?.trim() || undefined,
    bidangUjianSignUrl: d.bidangUjianSignUrl?.trim() || undefined,
    pengujiSignUrls: d.pengujiSignUrls
      ? d.pengujiSignUrls.map((n) => n.trim()).slice(0, 20)
      : undefined,
    updatedAt: new Date().toISOString(),
  };

  await prisma.appSetting.upsert({
    where: { key: UKT_TTD_TEMPLATE_KEY },
    create: { key: UKT_TTD_TEMPLATE_KEY, value: next },
    update: { value: next },
  });

  writeAuditLog({
    userId: authResult.user.id,
    email: authResult.user.email,
    action: "UKT_TTD_TEMPLATE",
    details: JSON.stringify({ keys: Object.keys(next) }),
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    token: authResult.token,
  });

  return NextResponse.json({
    success: true,
    data: next,
    message: "Template TTD disimpan",
  });
}
