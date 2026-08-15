import { prisma } from "@/lib/prisma";
import { DEFAULT_LATBER_FEE } from "@/lib/latber";

/** 3 digit terakhir NIA → 1–999; 0 / non-numerik → null. */
export function uniqueTailFromNia(nia: string | null | undefined): number | null {
  if (!nia) return null;
  const digits = String(nia).replace(/\D/g, "");
  if (digits.length === 0) return null;
  const tail = Number.parseInt(digits.slice(-3), 10);
  if (!Number.isFinite(tail) || tail < 1 || tail > 999) return null;
  return tail;
}

export async function allocateLatberUniqueTail(opts: {
  eventId: string;
  nia?: string | null;
}): Promise<{ uniqueTail: number; amount: number; baseFeeAmount: number }> {
  const baseFeeAmount = DEFAULT_LATBER_FEE;
  const preferred = uniqueTailFromNia(opts.nia);

  const regs = await prisma.eventRegistration.findMany({
    where: {
      eventId: opts.eventId,
      status: { notIn: ["CANCELLED", "REJECTED"] },
    },
    select: { id: true },
  });
  const regIds = regs.map((r) => r.id);

  const usedRows =
    regIds.length === 0
      ? []
      : await prisma.billing.findMany({
          where: {
            isDeleted: false,
            uniqueTail: { not: null },
            status: { notIn: ["CANCELLED"] },
            registrationId: { in: regIds },
          },
          select: { uniqueTail: true },
        });

  const used = new Set(
    usedRows
      .map((r) => r.uniqueTail)
      .filter((t): t is number => typeof t === "number" && t >= 1 && t <= 999),
  );

  let uniqueTail: number | null =
    preferred != null && !used.has(preferred) ? preferred : null;

  if (uniqueTail == null) {
    for (let t = 1; t <= 999; t++) {
      if (!used.has(t)) {
        uniqueTail = t;
        break;
      }
    }
  }

  if (uniqueTail == null) {
    throw new Error("Kode unik biaya Latber habis untuk periode ini");
  }

  return {
    uniqueTail,
    baseFeeAmount,
    amount: baseFeeAmount + uniqueTail,
  };
}
