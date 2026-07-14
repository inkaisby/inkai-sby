import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { inkaiFetch, inkaiErrorMessage } from "@/lib/inkai-api/server";
import { uktRegisterSchema } from "@/lib/security/schemas";
import { writeAuditLog } from "@/lib/audit";
import { getClientIp } from "@/lib/security/request";

export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) return authResult.error;
    if (!authResult.token) {
      return NextResponse.json({ error: "Token tidak tersedia" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
    }

    const parsed = uktRegisterSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
    }

    const { eventId, memberId } = parsed.data;

    const { res, data } = await inkaiFetch(
      "/v1/events/register",
      {
        method: "POST",
        body: JSON.stringify({ eventId, memberId }),
      },
      authResult.token,
    );

    if (!res.ok) {
      const message = inkaiErrorMessage(data, "Gagal mendaftarkan anggota");
      const status = message.toLowerCase().includes("already") ? 409 : res.status;
      return NextResponse.json({ error: message }, { status });
    }

    const registration = data.data as Record<string, unknown>;
    const member = registration.member as { fullName?: string } | undefined;
    const event = registration.event as { title?: string } | undefined;

    writeAuditLog({
      userId: authResult.user.id,
      email: authResult.user.email,
      action: "UKT_REGISTER",
      details: `Registered ${member?.fullName ?? memberId} for ${event?.title ?? eventId}`,
      ip: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      token: authResult.token,
    });

    const billings = (member as { billings?: Array<{ id: string }> } | undefined)?.billings;
    return NextResponse.json({
      success: true,
      registrationId: registration.id,
      billingId: billings?.[0]?.id ?? null,
    });
  } catch (error) {
    console.error("[UKT Register]", error);
    const message = error instanceof Error ? error.message : "Gagal mendaftarkan anggota";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
