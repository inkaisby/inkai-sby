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

export async function allocateLatberUniqueTail(_opts: {
  eventId: string;
  nia?: string | null;
}): Promise<{ uniqueTail: null; amount: number; baseFeeAmount: number }> {
  const baseFeeAmount = DEFAULT_LATBER_FEE;
  return {
    uniqueTail: null,
    baseFeeAmount,
    amount: baseFeeAmount,
  };
}
