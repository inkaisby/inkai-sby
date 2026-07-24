import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { inkaiFetch, inkaiErrorMessage } from "@/lib/inkai-api/server";
import { canEditKyuBaru } from "@/lib/belt";
import {
  beltFeesFromTemplates,
  BELT_FEE_KEYS,
  BELT_FEE_LABELS,
  DEFAULT_KOMISI_RANTING,
  findTemplatesForBeltFee,
  normalizeBeltFeeRankName,
  UKT_KOMISI_SETTING_KEY,
} from "@/lib/ukt";
import { uktBeltFeesSchema } from "@/lib/security/schemas";
import { writeAuditLog } from "@/lib/audit";
import { getClientIp } from "@/lib/security/request";
import { rateLimitAsync, rateLimitResponse } from "@/lib/security/rate-limit";
import {
  assertUktPeriodMutable,
  mergeUktPeriodMeta,
  saveUktPeriodMeta,
} from "@/lib/ukt-period-meta-store";

async function loadKomisiRanting(token: string): Promise<number> {
  const { res, data } = await inkaiFetch(`/v1/settings/${UKT_KOMISI_SETTING_KEY}`, {}, token);
  if (!res.ok) return DEFAULT_KOMISI_RANTING;
  const value = (data.data as { value?: unknown } | undefined)?.value;
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
  if (!authResult.token) {
    return NextResponse.json({ error: "Token tidak tersedia" }, { status: 401 });
  }

  const [templatesRes, komisiRanting] = await Promise.all([
    inkaiFetch("/v1/events/rank-fee-templates", {}, authResult.token),
    loadKomisiRanting(authResult.token),
  ]);

  if (!templatesRes.res.ok) {
    return NextResponse.json({ fees: {}, komisiRanting });
  }

  const templates = (templatesRes.data.data as Array<{ rankName: string; fee: number }>) ?? [];
  return NextResponse.json({ fees: beltFeesFromTemplates(templates), komisiRanting });
}

export async function PUT(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!authResult.token) {
    return NextResponse.json({ error: "Token tidak tersedia" }, { status: 401 });
  }

  if (!canEditKyuBaru(authResult.user.roles)) {
    return NextResponse.json({ error: "Hanya admin cabang yang dapat mengubah pengaturan UKT" }, { status: 403 });
  }

  const rlKey = `ukt:fees:${authResult.user.id}`;
  const limited = await rateLimitAsync(rlKey, { max: 20, windowMs: 60_000 });
  if (!limited.success) {
    return rateLimitResponse(limited.retryAfterSec ?? 60, rlKey);
  }

  const body = await request.json();
  const parsed = uktBeltFeesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data pengaturan UKT tidak valid" }, { status: 400 });
  }

  const {
    komisiRanting,
    eventId,
    updateGlobal,
    PUTIH,
    KUNING,
    HIJAU,
    BIRU,
    COKELAT,
  } = parsed.data;
  const fees = { PUTIH, KUNING, HIJAU, BIRU, COKELAT };
  const shouldUpdateGlobal = updateGlobal ?? !eventId;

  if (eventId) {
    const periodMutable = await assertUktPeriodMutable(authResult.token, eventId);
    if (!periodMutable.ok) {
      return NextResponse.json(
        { error: periodMutable.error },
        { status: periodMutable.status },
      );
    }

    const current = periodMutable.meta;
    const next = mergeUktPeriodMeta(current, {
      beltFees: fees,
      komisiRanting,
      by: authResult.user.email,
    });
    const saved = await saveUktPeriodMeta(authResult.token, eventId, next);
    if (!saved.ok) {
      return NextResponse.json(
        { error: inkaiErrorMessage(saved.errorData as Record<string, unknown>, "Gagal menyimpan biaya periode") },
        { status: saved.status },
      );
    }
  }

  if (!shouldUpdateGlobal) {
    writeAuditLog({
      userId: authResult.user.id,
      email: authResult.user.email,
      action: "UKT_SETTINGS_UPDATE",
      details: JSON.stringify({ fees, komisiRanting, eventId, updateGlobal: false }),
      ip: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      token: authResult.token,
    });
    return NextResponse.json({
      success: true,
      fees,
      komisiRanting,
      periodSnapshot: Boolean(eventId),
    });
  }

  const { res: listRes, data: listData } = await inkaiFetch(
    "/v1/events/rank-fee-templates",
    {},
    authResult.token,
  );
  if (!listRes.ok) {
    return NextResponse.json({ error: "Gagal memuat template biaya" }, { status: 500 });
  }

  const existing = (listData.data as Array<{ id: string; rankName: string; fee: number }>) ?? [];
  const usedIds = new Set<string>();
  const templates: Array<{ id: string; rankName: string; fee: number }> = [];

  for (const key of BELT_FEE_KEYS) {
    const label = BELT_FEE_LABELS[key];
    const matches = findTemplatesForBeltFee(existing, key).filter((t) => !usedIds.has(t.id));
    if (matches.length === 0) {
      return NextResponse.json(
        {
          error: `Template biaya sabuk "${label}" tidak ditemukan. Perbaiki data RankFeeTemplate lalu coba lagi.`,
        },
        { status: 400 },
      );
    }

    const canonical = label.toLowerCase();
    const preferred =
      matches.find((t) => normalizeBeltFeeRankName(t.rankName) === canonical) ?? matches[0];

    for (const match of matches) {
      usedIds.add(match.id);
      templates.push({
        id: match.id,
        rankName: match.id === preferred.id ? label : match.rankName,
        fee: fees[key],
      });
    }
  }

  const { res, data } = await inkaiFetch(
    "/v1/events/rank-fee-templates",
    {
      method: "PUT",
      body: JSON.stringify({ templates }),
    },
    authResult.token,
  );

  if (!res.ok) {
    return NextResponse.json(
      { error: inkaiErrorMessage(data, "Gagal menyimpan biaya sabuk") },
      { status: res.status },
    );
  }

  await inkaiFetch(
    `/v1/settings/${UKT_KOMISI_SETTING_KEY}`,
    {
      method: "PUT",
      body: JSON.stringify({ value: komisiRanting }),
    },
    authResult.token,
  );

  writeAuditLog({
    userId: authResult.user.id,
    email: authResult.user.email,
    action: "UKT_SETTINGS_UPDATE",
    details: JSON.stringify({ fees, komisiRanting, eventId }),
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    token: authResult.token,
  });

  return NextResponse.json({
    success: true,
    fees,
    komisiRanting,
    periodSnapshot: Boolean(eventId),
  });
}
