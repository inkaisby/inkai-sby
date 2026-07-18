import { prisma } from "@/lib/prisma";

export const MEMBER_LIFECYCLE_KEY_PREFIX = "member.lifecycle.";

export const DEACTIVATE_REASON_CODES = [
  "BERHENTI_LATIHAN",
  "PINDAH_DOJO",
  "PINDAH_KOTA",
  "TUNGGAKAN",
  "DISIPLIN",
  "LAINNYA",
] as const;

export type DeactivateReasonCode = (typeof DEACTIVATE_REASON_CODES)[number];

export const DEACTIVATE_REASON_LABELS: Record<DeactivateReasonCode, string> = {
  BERHENTI_LATIHAN: "Berhenti latihan",
  PINDAH_DOJO: "Pindah dojo / ranting",
  PINDAH_KOTA: "Pindah kota / cabang",
  TUNGGAKAN: "Tunggakan iuran",
  DISIPLIN: "Sanksi disiplin",
  LAINNYA: "Lainnya",
};

export type MemberStatusKind = "INACTIVE" | "SUSPENDED";

export type MemberLifecycleMeta = {
  statusKind: MemberStatusKind;
  reasonCode: DeactivateReasonCode;
  reasonNote: string | null;
  changedAt: string;
  changedByUserId: string;
  changedByEmail: string | null;
  changedByName: string | null;
  previousStatus?: string | null;
};

export function lifecycleSettingKey(memberId: string) {
  return `${MEMBER_LIFECYCLE_KEY_PREFIX}${memberId}`;
}

export function reasonLabel(code: string | null | undefined) {
  if (!code) return "—";
  return (
    DEACTIVATE_REASON_LABELS[code as DeactivateReasonCode] || code
  );
}

export function statusKindLabel(kind: string | null | undefined) {
  if (kind === "SUSPENDED") return "Ditangguhkan";
  if (kind === "INACTIVE") return "Nonaktif";
  return kind || "—";
}

function parseMeta(value: unknown): MemberLifecycleMeta | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.changedAt !== "string") return null;
  if (typeof v.reasonCode !== "string") return null;
  const statusKind =
    v.statusKind === "SUSPENDED" ? "SUSPENDED" : "INACTIVE";
  return {
    statusKind,
    reasonCode: v.reasonCode as DeactivateReasonCode,
    reasonNote: typeof v.reasonNote === "string" ? v.reasonNote : null,
    changedAt: v.changedAt,
    changedByUserId: String(v.changedByUserId || ""),
    changedByEmail:
      typeof v.changedByEmail === "string" ? v.changedByEmail : null,
    changedByName:
      typeof v.changedByName === "string" ? v.changedByName : null,
    previousStatus:
      typeof v.previousStatus === "string" ? v.previousStatus : null,
  };
}

export async function getMemberLifecycle(
  memberId: string,
): Promise<MemberLifecycleMeta | null> {
  const row = await prisma.appSetting.findUnique({
    where: { key: lifecycleSettingKey(memberId) },
  });
  return parseMeta(row?.value);
}

export async function getMemberLifecycles(
  memberIds: string[],
): Promise<Map<string, MemberLifecycleMeta>> {
  const map = new Map<string, MemberLifecycleMeta>();
  if (memberIds.length === 0) return map;
  const keys = memberIds.map(lifecycleSettingKey);
  const rows = await prisma.appSetting.findMany({
    where: { key: { in: keys } },
  });
  for (const row of rows) {
    const id = row.key.slice(MEMBER_LIFECYCLE_KEY_PREFIX.length);
    const meta = parseMeta(row.value);
    if (meta) map.set(id, meta);
  }
  return map;
}

export async function setMemberLifecycle(
  memberId: string,
  meta: MemberLifecycleMeta,
) {
  await prisma.appSetting.upsert({
    where: { key: lifecycleSettingKey(memberId) },
    create: { key: lifecycleSettingKey(memberId), value: meta },
    update: { value: meta },
  });
}

export async function clearMemberLifecycle(memberId: string) {
  await prisma.appSetting.deleteMany({
    where: { key: lifecycleSettingKey(memberId) },
  });
}

export type MemberImpactSummary = {
  unpaidBillingCount: number;
  unpaidBillingAmount: number;
  openEventRegistrationCount: number;
  uktOpenCount: number;
};

export async function getMemberImpact(
  memberId: string,
): Promise<MemberImpactSummary> {
  const [unpaid, openRegs] = await Promise.all([
    prisma.billing.findMany({
      where: {
        memberId,
        isDeleted: false,
        status: { not: "PAID" },
      },
      select: { amount: true, status: true },
    }),
    prisma.eventRegistration.findMany({
      where: {
        memberId,
        status: { notIn: ["CANCELLED", "REJECTED"] },
      },
      select: {
        status: true,
        event: { select: { title: true } },
      },
    }),
  ]);

  const uktOpenCount = openRegs.filter((r) =>
    String(r.event?.title || "")
      .toUpperCase()
      .includes("UKT"),
  ).length;

  return {
    unpaidBillingCount: unpaid.length,
    unpaidBillingAmount: unpaid.reduce((s, b) => s + (b.amount || 0), 0),
    openEventRegistrationCount: openRegs.length,
    uktOpenCount,
  };
}

export function monthsSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  return (
    (now.getFullYear() - d.getFullYear()) * 12 +
    (now.getMonth() - d.getMonth())
  );
}
