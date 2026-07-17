import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { inkaiFetch, inkaiErrorMessage } from "@/lib/inkai-api/server";
import { getPrimaryAdminRole } from "@/lib/rbac";
import { canCreateEventsByWilayah } from "@/lib/wilayah-rbac";
import { uktInvoiceAckSchema } from "@/lib/security/schemas";
import { writeAuditLog } from "@/lib/audit";
import { getClientIp } from "@/lib/security/request";

function ackKey(eventId: string, dojoId: string) {
  return `ukt-invoice-ack:${eventId}:${dojoId}`;
}

export async function GET(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!authResult.token) {
    return NextResponse.json({ error: "Token tidak tersedia" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId");
  if (!eventId) {
    return NextResponse.json({ error: "eventId wajib" }, { status: 400 });
  }

  const prefix = `ukt-invoice-ack:${eventId}:`;
  const { res, data } = await inkaiFetch(
    `/v1/settings?prefix=${encodeURIComponent(prefix)}`,
    {},
    authResult.token,
  );

  if (!res.ok) {
    return NextResponse.json({ acks: {} });
  }

  const settings = (data.data as Array<{ key: string; value: unknown }>) ?? [];
  const acks: Record<string, { acknowledged: boolean; at: string; by: string }> = {};
  for (const s of settings) {
    const dojoId = s.key.split(":").pop()!;
    const val = s.value as { acknowledged?: boolean; at?: string; by?: string };
    acks[dojoId] = {
      acknowledged: !!val.acknowledged,
      at: val.at || "",
      by: val.by || "",
    };
  }

  return NextResponse.json({ acks });
}

export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!authResult.token) {
    return NextResponse.json({ error: "Token tidak tersedia" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = uktInvoiceAckSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const { eventId, dojoId, acknowledged } = parsed.data;
  const role = getPrimaryAdminRole(authResult.user.roles);

  const key = ackKey(eventId, dojoId);
  const value = {
    acknowledged,
    at: new Date().toISOString(),
    by: authResult.user.email,
    role,
  };

  const { res, data } = await inkaiFetch(
    `/v1/settings/${encodeURIComponent(key)}`,
    {
      method: "PUT",
      body: JSON.stringify({ value }),
    },
    authResult.token,
  );

  if (!res.ok) {
    return NextResponse.json(
      { error: inkaiErrorMessage(data, "Gagal menyimpan konfirmasi invoice") },
      { status: res.status },
    );
  }

  writeAuditLog({
    userId: authResult.user.id,
    email: authResult.user.email,
    action: acknowledged ? "UKT_INVOICE_ACK" : "UKT_INVOICE_UNACK",
    details: `Invoice ack for event ${eventId} dojo ${dojoId}: ${acknowledged}`,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    token: authResult.token,
  });

  return NextResponse.json({ success: true, ack: value });
}

export async function PUT(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!authResult.token) {
    return NextResponse.json({ error: "Token tidak tersedia" }, { status: 401 });
  }

  const canCreate = canCreateEventsByWilayah(authResult.user.roles);
  if (!canCreate) {
    return NextResponse.json({ error: "Hanya admin cabang yang dapat membuat invoice" }, { status: 403 });
  }

  const body = await request.json();
  const { eventId, memberIds } = body as {
    eventId?: string;
    dojoId?: string;
    memberIds?: string[];
  };

  if (!eventId || !memberIds?.length) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const { res, data } = await inkaiFetch(
    "/v1/events/register/bulk",
    {
      method: "POST",
      body: JSON.stringify({ eventId, memberIds }),
    },
    authResult.token,
  );

  if (!res.ok) {
    return NextResponse.json(
      { error: inkaiErrorMessage(data, "Gagal membuat invoice") },
      { status: res.status },
    );
  }

  const result = data.data as { succeeded?: unknown[] } | undefined;
  return NextResponse.json({ success: true, created: result?.succeeded?.length ?? 0 });
}
