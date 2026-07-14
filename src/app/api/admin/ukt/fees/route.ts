import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { inkaiFetch, inkaiErrorMessage } from "@/lib/inkai-api/server";
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

  const body = await request.json();
  const parsed = uktBeltFeesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data pengaturan UKT tidak valid" }, { status: 400 });
  }

  const { komisiRanting, ...fees } = parsed.data;

  const { res: listRes, data: listData } = await inkaiFetch(
    "/v1/events/rank-fee-templates",
    {},
    authResult.token,
  );
  if (!listRes.ok) {
    return NextResponse.json({ error: "Gagal memuat template biaya" }, { status: 500 });
  }

  const existing = (listData.data as Array<{ id: string; rankName: string; fee: number }>) ?? [];
  const templates = BELT_FEE_KEYS.map((key) => {
    const label = BELT_LABELS[key];
    const found = existing.find((t) => t.rankName.toLowerCase().startsWith(label.toLowerCase()));
    return {
      id: found?.id ?? existing[0]?.id ?? "",
      rankName: label,
      fee: fees[key],
    };
  }).filter((t) => t.id);

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
    details: JSON.stringify({ fees, komisiRanting }),
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    token: authResult.token,
  });

  return NextResponse.json({ success: true, fees, komisiRanting });
}
