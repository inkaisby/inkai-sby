import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import { memberBillingPeriodReportSchema } from "@/lib/security/schemas";
import { reportIuranSetorPeriod } from "@/lib/iuran-setor-period";
import { getClientIp } from "@/lib/security/request";

export async function POST(request: Request) {
  const session = await auth();
  const token = await getInkaiAccessToken();
  const memberId = session?.user.memberId;
  if (!memberId || !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = memberBillingPeriodReportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Data tidak valid" },
      { status: 400 },
    );
  }

  const result = await reportIuranSetorPeriod({
    memberId,
    period: parsed.data.period,
    paidAtYmd: parsed.data.paidAt,
    token,
    paymentMethod: parsed.data.paymentMethod,
    billingAction: "member_report_setor",
    actor: {
      userId: session.user.id,
      email: session.user.email,
    },
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status },
    );
  }

  return NextResponse.json({
    success: true,
    message: result.message,
    billingId: result.billingId,
    period: result.period,
  });
}
