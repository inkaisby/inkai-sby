import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import { inkaiFetch, inkaiErrorMessage } from "@/lib/inkai-api/server";
import { memberBillingProofSchema } from "@/lib/security/schemas";

type RouteContext = { params: Promise<{ id: string }> };

async function trySubmitProof(
  token: string,
  billingId: string,
  proofUrl: string,
  paymentMethod?: string,
) {
  const payloads: Array<{ path: string; body: Record<string, unknown> }> = [
    {
      path: "/v1/billing/pay",
      body: {
        billingId,
        proofUrl,
        paymentMethod: paymentMethod || "TRANSFER",
        status: "WAITING_VERIFICATION",
      },
    },
    {
      path: `/v1/billing/${billingId}/pay`,
      body: {
        proofUrl,
        paymentMethod: paymentMethod || "TRANSFER",
      },
    },
    {
      path: `/v1/billing/${billingId}`,
      body: {
        proofUrl,
        paymentMethod: paymentMethod || "TRANSFER",
        status: "WAITING_VERIFICATION",
      },
    },
  ];

  let lastError = "Gagal mengirim bukti pembayaran";
  let lastStatus = 400;

  for (const attempt of payloads) {
    const method = attempt.path.endsWith(`/billing/${billingId}`) ? "PATCH" : "POST";
    const { res, data } = await inkaiFetch(
      attempt.path,
      { method, body: JSON.stringify(attempt.body) },
      token,
    );
    if (res.ok) {
      return { ok: true as const, data };
    }
    // Coba endpoint berikutnya jika belum ada / path salah
    if (res.status === 404 || res.status === 405) {
      lastError = inkaiErrorMessage(data, lastError);
      lastStatus = res.status;
      continue;
    }
    return {
      ok: false as const,
      error: inkaiErrorMessage(data, lastError),
      status: res.status,
    };
  }

  return { ok: false as const, error: lastError, status: lastStatus };
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await auth();
  const token = await getInkaiAccessToken();
  if (!session?.user.memberId || !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = memberBillingProofSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Data tidak valid" },
      { status: 400 },
    );
  }

  const result = await trySubmitProof(
    token,
    id,
    parsed.data.proofUrl,
    parsed.data.paymentMethod,
  );

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status || 400 },
    );
  }

  return NextResponse.json({
    success: true,
    message: "Bukti pembayaran terkirim. Menunggu verifikasi pengurus.",
    billing: result.data.data,
  });
}
