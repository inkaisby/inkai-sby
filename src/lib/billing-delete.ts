import { inkaiFetch, inkaiErrorMessage } from "@/lib/inkai-api/server";
import { prisma } from "@/lib/prisma";

export type DeleteBillingHardResult = {
  ok: boolean;
  error?: string;
  status?: number;
};

/**
 * Hapus tagihan lewat Inkai (force DELETE → PATCH void → soft-delete lokal).
 * `continueOnFailure`: bila true (mode force cabang), tetap ok agar alur berikutnya bisa lanjut.
 */
export async function deleteBillingHard(
  token: string,
  targetBillingId: string,
  opts?: { continueOnFailure?: boolean },
): Promise<DeleteBillingHardResult> {
  const attempts = [
    `/v1/billing/${targetBillingId}?force=true`,
    `/v1/billing/${targetBillingId}?force=1`,
    `/v1/billing/${targetBillingId}`,
  ];

  let lastError = "Gagal menghapus tagihan";
  let lastStatus = 400;

  for (const path of attempts) {
    const { res, data } = await inkaiFetch(path, { method: "DELETE" }, token);
    if (res.ok || res.status === 404) return { ok: true };
    lastError = inkaiErrorMessage(data, lastError);
    lastStatus = res.status;
  }

  const patchAttempts = [
    { isDeleted: true },
    { status: "CANCELLED", isDeleted: true },
    { status: "REJECTED" },
  ];
  for (const body of patchAttempts) {
    const { res } = await inkaiFetch(
      `/v1/billing/${targetBillingId}`,
      { method: "PATCH", body: JSON.stringify(body) },
      token,
    );
    if (res.ok) {
      const { res: delRes } = await inkaiFetch(
        `/v1/billing/${targetBillingId}?force=true`,
        { method: "DELETE" },
        token,
      );
      if (delRes.ok || delRes.status === 404) return { ok: true };
      return { ok: true };
    }
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
  return { ok: false, error: lastError, status: lastStatus };
}
