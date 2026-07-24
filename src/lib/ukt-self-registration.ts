import { prisma } from "@/lib/prisma";

/** Meta pendaftaran UKT mandiri (AppSetting). */
export type UktSelfRegistrationMeta = {
  source: "member";
  registeredAt: string;
  memberPaymentConfirmedAt: string | null;
};

export function uktSelfRegistrationKey(
  eventId: string,
  memberId: string,
): string {
  return `ukt-self-reg:${eventId}:${memberId}`;
}

export function parseUktSelfRegistrationMeta(
  value: unknown,
): UktSelfRegistrationMeta | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (raw.source !== "member") return null;
  return {
    source: "member",
    registeredAt:
      typeof raw.registeredAt === "string"
        ? raw.registeredAt
        : new Date().toISOString(),
    memberPaymentConfirmedAt:
      typeof raw.memberPaymentConfirmedAt === "string"
        ? raw.memberPaymentConfirmedAt
        : null,
  };
}

export async function loadUktSelfRegistrationMeta(
  eventId: string,
  memberId: string,
): Promise<UktSelfRegistrationMeta | null> {
  const row = await prisma.appSetting.findUnique({
    where: { key: uktSelfRegistrationKey(eventId, memberId) },
  });
  return parseUktSelfRegistrationMeta(row?.value);
}

export async function upsertUktSelfRegistrationMeta(
  eventId: string,
  memberId: string,
  meta: UktSelfRegistrationMeta,
): Promise<void> {
  const key = uktSelfRegistrationKey(eventId, memberId);
  await prisma.appSetting.upsert({
    where: { key },
    create: { key, value: meta },
    update: { value: meta },
  });
}

export async function deleteUktSelfRegistrationMeta(
  eventId: string,
  memberId: string,
): Promise<void> {
  try {
    await prisma.appSetting.delete({
      where: { key: uktSelfRegistrationKey(eventId, memberId) },
    });
  } catch {
    /* ignore missing */
  }
}

export async function loadUktSelfRegistrationMetaMap(
  eventId: string,
): Promise<Map<string, UktSelfRegistrationMeta>> {
  const prefix = `ukt-self-reg:${eventId}:`;
  const rows = await prisma.appSetting.findMany({
    where: { key: { startsWith: prefix } },
    select: { key: true, value: true },
  });
  const map = new Map<string, UktSelfRegistrationMeta>();
  for (const row of rows) {
    const memberId = row.key.slice(prefix.length);
    const meta = parseUktSelfRegistrationMeta(row.value);
    if (meta) map.set(memberId, meta);
  }
  return map;
}

export function isUktEventBilling(opts: {
  type?: string | null;
  description?: string | null;
}): boolean {
  const type = String(opts.type ?? "").toUpperCase();
  const desc = String(opts.description ?? "").toUpperCase();
  return type.includes("UKT") || type === "EVENT" || desc.includes("UKT");
}

/** Strip nominal tagihan UKT sebelum dikirim ke UI anggota. */
export function stripUktAmountForMemberUI<
  T extends {
    type?: string | null;
    description?: string | null;
    amount?: number | null;
  },
>(billing: T): T & { amount: number | null; hideAmount: boolean } {
  if (isUktEventBilling(billing)) {
    return { ...billing, amount: null, hideAmount: true };
  }
  return {
    ...billing,
    amount: billing.amount ?? null,
    hideAmount: false,
  };
}
