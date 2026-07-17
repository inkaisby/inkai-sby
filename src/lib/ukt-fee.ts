import type { Prisma } from "@prisma/client";

/**
 * UKT tidak memakai kode unik. Selalu kembalikan biaya dasar bulat
 * tanpa +1..999 di belakang nominal.
 */
export async function pickUniqueEventFeeAmount(
  _tx: Prisma.TransactionClient,
  _eventId: string,
  baseFee: number,
  _excludeBillingId?: string,
): Promise<{ baseRounded: number; uniqueTail: number; total: number }> {
  const baseRounded = Math.round(baseFee);
  return { baseRounded, uniqueTail: 0, total: baseRounded };
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
