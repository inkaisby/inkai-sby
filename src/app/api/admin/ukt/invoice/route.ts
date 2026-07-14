import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { buildEventFilter, getPrimaryAdminRole } from "@/lib/rbac";
import { uktInvoiceAckSchema } from "@/lib/security/schemas";
import { writeAuditLog } from "@/lib/audit";
import { getClientIp } from "@/lib/security/request";

function ackKey(eventId: string, dojoId: string) {
  return `ukt-invoice-ack:${eventId}:${dojoId}`;
}

export async function GET(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId");
  if (!eventId) {
    return NextResponse.json({ error: "eventId wajib" }, { status: 400 });
  }

  const settings = await prisma.appSetting.findMany({
    where: { key: { startsWith: `ukt-invoice-ack:${eventId}:` } },
  });

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

  const body = await request.json();
  const parsed = uktInvoiceAckSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const { eventId, dojoId, acknowledged } = parsed.data;

  const event = await prisma.event.findFirst({
    where: { id: eventId, ...buildEventFilter(authResult.user), isDeleted: false },
  });
  if (!event) {
    return NextResponse.json({ error: "Periode UKT tidak ditemukan" }, { status: 404 });
  }

  const role = getPrimaryAdminRole(authResult.user.roles);
  const isDojoAdmin = role === "ADMIN_DOJO";

  if (acknowledged && !isDojoAdmin && !["ADMINISTRATOR", "ADMIN_PUSAT", "ADMIN"].includes(role)) {
    // Ketua ranting acknowledges receipt
  }

  const key = ackKey(eventId, dojoId);
  const value = {
    acknowledged,
    at: new Date().toISOString(),
    by: authResult.user.email,
    role,
  };

  await prisma.appSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });

  await writeAuditLog({
    userId: authResult.user.id,
    email: authResult.user.email,
    action: acknowledged ? "UKT_INVOICE_ACK" : "UKT_INVOICE_UNACK",
    details: `Invoice ack for event ${eventId} dojo ${dojoId}: ${acknowledged}`,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ success: true, ack: value });
}

export async function PUT(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  const role = getPrimaryAdminRole(authResult.user.roles);
  const canCreate = ["ADMINISTRATOR", "ADMIN_PUSAT", "ADMIN_PROVINCE", "ADMIN_BRANCH", "ADMIN"].includes(role);
  if (!canCreate) {
    return NextResponse.json({ error: "Hanya admin cabang yang dapat membuat invoice" }, { status: 403 });
  }

  const body = await request.json();
  const { eventId, dojoId, memberIds } = body as {
    eventId?: string;
    dojoId?: string;
    memberIds?: string[];
  };

  if (!eventId || !dojoId || !memberIds?.length) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const registrations = await prisma.eventRegistration.findMany({
    where: {
      eventId,
      memberId: { in: memberIds },
      member: { dojoId },
      status: { in: ["APPROVED", "PAID", "SUCCESS", "PENDING"] },
    },
    include: {
      member: true,
      category: true,
    },
  });

  const templates = await prisma.rankFeeTemplate.findMany();
  let created = 0;

  await prisma.$transaction(async (tx) => {
    for (const reg of registrations) {
      const existing = await tx.billing.findFirst({
        where: { registrationId: reg.id, isDeleted: false },
      });
      if (existing) continue;

      const baseFee = reg.category?.fee ?? templates.find((t) =>
        reg.member.currentRank.toLowerCase().includes(t.rankName.toLowerCase().split(" ")[1] || ""),
      )?.fee ?? 285000;

      const { baseRounded, uniqueTail, total } = await pickUniqueFromTx(tx, eventId, baseFee);

      await tx.billing.create({
        data: {
          memberId: reg.memberId,
          registrationId: reg.id,
          type: "EVENT_FEE",
          amount: total,
          baseFeeAmount: baseRounded,
          uniqueTail,
          description: `Invoice UKT — ${reg.member.fullName}`,
          dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          status: "PENDING",
        },
      });
      created++;
    }
  });

  return NextResponse.json({ success: true, created });
}

async function pickUniqueFromTx(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  eventId: string,
  baseFee: number,
) {
  const { pickUniqueEventFeeAmount } = await import("@/lib/ukt-fee");
  return pickUniqueEventFeeAmount(tx, eventId, baseFee);
}
