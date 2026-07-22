import { inkaiFetch, inkaiErrorMessage } from "@/lib/inkai-api/server";
import { prisma } from "@/lib/prisma";

export type DeleteBillingHardResult = {
  ok: boolean;
  error?: string;
  status?: number;
};

const FAST = { timeoutMs: 5_000, retries: 0 as const };

/**
 * Hapus / putuskan tagihan cepat (timeout pendek, sedikit percobaan).
 * Urutan: unlink → DELETE force → soft-delete lokal.
 */
export async function deleteBillingHard(
  token: string,
  targetBillingId: string,
  opts?: { continueOnFailure?: boolean },
): Promise<DeleteBillingHardResult> {
  // Putuskan tautan ke pendaftaran dulu — ini yang biasanya memblokir DELETE register
  await inkaiFetch(
    `/v1/billing/${targetBillingId}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        registrationId: null,
        isDeleted: true,
        status: "CANCELLED",
      }),
    },
    token,
    FAST,
  );

  const { res, data } = await inkaiFetch(
    `/v1/billing/${targetBillingId}?force=true`,
    { method: "DELETE" },
    token,
    FAST,
  );
  if (res.ok || res.status === 404) {
    try {
      await prisma.billing.updateMany({
        where: { id: targetBillingId },
        data: { isDeleted: true },
      });
    } catch {
      /* ignore */
    }
    return { ok: true };
  }

  // Satu cadangan DELETE biasa
  const second = await inkaiFetch(
    `/v1/billing/${targetBillingId}`,
    { method: "DELETE" },
    token,
    FAST,
  );
  if (second.res.ok || second.res.status === 404) {
    try {
      await prisma.billing.updateMany({
        where: { id: targetBillingId },
        data: { isDeleted: true },
      });
    } catch {
      /* ignore */
    }
    return { ok: true };
  }

  try {
    await prisma.billing.updateMany({
      where: { id: targetBillingId },
      data: { isDeleted: true },
    });
  } catch (error) {
    console.error("[billing-delete] local soft-delete failed", error);
  }

  if (opts?.continueOnFailure) return { ok: true };
  return {
    ok: false,
    error: inkaiErrorMessage(data, inkaiErrorMessage(second.data, "Gagal menghapus tagihan")),
    status: second.res.status || res.status || 400,
  };
}

/** Hapus banyak tagihan secara paralel. */
export async function deleteBillingsHard(
  token: string,
  billingIds: Iterable<string>,
  opts?: { continueOnFailure?: boolean },
): Promise<void> {
  const ids = [...new Set([...billingIds].filter(Boolean))];
  if (ids.length === 0) return;
  await Promise.all(
    ids.map((id) => deleteBillingHard(token, id, opts)),
  );
}
