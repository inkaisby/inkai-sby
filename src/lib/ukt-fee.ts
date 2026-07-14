import type { Prisma } from "@prisma/client";

const TRACK_STATUSES = ["PENDING", "WAITING_VERIFICATION"] as const;

export async function pickUniqueEventFeeAmount(
  tx: Prisma.TransactionClient,
  eventId: string,
  baseFee: number,
  excludeBillingId?: string,
): Promise<{ baseRounded: number; uniqueTail: number; total: number }> {
  const baseRounded = Math.round(baseFee);

  const regRows = await tx.eventRegistration.findMany({
    where: { eventId },
    select: { id: true },
  });
  const regIds = regRows.map((r) => r.id);

  const taken =
    regIds.length === 0
      ? []
      : await tx.billing.findMany({
          where: {
            type: "EVENT_FEE",
            status: { in: [...TRACK_STATUSES] },
            registrationId: { in: regIds },
            isDeleted: false,
            ...(excludeBillingId ? { NOT: { id: excludeBillingId } } : {}),
          },
          select: { amount: true },
        });
  const usedTotals = new Set(taken.map((b) => Math.round(b.amount)));

  for (let uniqueTail = 1; uniqueTail <= 999; uniqueTail++) {
    const total = baseRounded + uniqueTail;
    if (!usedTotals.has(total)) {
      return { baseRounded, uniqueTail, total };
    }
  }

  throw new Error(
    "Kuota kode unik untuk agenda ini penuh. Hubungi administrator.",
  );
}

export async function resolveRankFee(
  rankText: string,
  templates: { rankName: string; fee: number }[],
): Promise<number> {
  const normalized = rankText.trim().toLowerCase();
  for (const t of templates) {
    if (normalized.includes(t.rankName.toLowerCase())) return t.fee;
  }
  const group = normalized.includes("putih")
    ? "putih"
    : normalized.includes("kuning") || normalized.includes("oranye")
      ? "kuning"
      : normalized.includes("hijau")
        ? "hijau"
        : normalized.includes("biru")
          ? "biru"
          : normalized.includes("coklat")
            ? "coklat"
            : null;
  if (group) {
    const match = templates.find((t) => t.rankName.toLowerCase().includes(group));
    if (match) return match.fee;
  }
  return 285000;
}
