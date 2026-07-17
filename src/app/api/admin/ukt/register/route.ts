import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { inkaiFetch, inkaiErrorMessage } from "@/lib/inkai-api/server";
import {
  DEFAULT_MEMBER_RANK,
  encodeUktRegisteredRank,
  formatRankLabel,
} from "@/lib/belt";
import { canRegisterMembersToEvents } from "@/lib/wilayah-rbac";
import { uktRegisterSchema } from "@/lib/security/schemas";
import { writeAuditLog } from "@/lib/audit";
import { getClientIp } from "@/lib/security/request";
import { validateUktRegistrationEligibility } from "@/lib/ukt-register";
import { notifyUktStatusChange } from "@/lib/ukt-notify";

export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) return authResult.error;
    if (!authResult.token) {
      return NextResponse.json({ error: "Token tidak tersedia" }, { status: 401 });
    }

    if (!canRegisterMembersToEvents(authResult.user.roles)) {
      return NextResponse.json(
        { error: "Anda tidak berwenang mendaftarkan anggota ke event" },
        { status: 403 },
      );
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

    const eligibility = await validateUktRegistrationEligibility(
      authResult.token,
      eventId,
      memberId,
    );
    if (!eligibility.ok) {
      return NextResponse.json({ error: eligibility.error }, { status: 400 });
    }

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
    const registrationId = String(registration.id);

    // Kunci Kyu Lama saat daftar (snapshot sabuk saat ini) — tidak berubah saat Kyu Baru diisi
    let kyuLamaSnapshot = "";
    const regMember = registration.member as { currentRank?: string } | undefined;
    if (regMember?.currentRank) {
      kyuLamaSnapshot =
        formatRankLabel(regMember.currentRank) || regMember.currentRank;
    } else {
      const { res: mRes, data: mData } = await inkaiFetch(
        `/v1/members/${memberId}`,
        {},
        authResult.token,
      );
      if (mRes.ok) {
        const member = mData.data as { currentRank?: string };
        kyuLamaSnapshot =
          formatRankLabel(member?.currentRank) ||
          String(member?.currentRank || "");
      }
    }
    if (!kyuLamaSnapshot) kyuLamaSnapshot = DEFAULT_MEMBER_RANK;

    const { res: approveRes, data: approveData } = await inkaiFetch(
      `/v1/events/register/${registrationId}`,
      {
        method: "PUT",
        body: JSON.stringify({
          status: "APPROVED",
          registeredRank: encodeUktRegisteredRank(kyuLamaSnapshot, ""),
        }),
      },
      authResult.token,
    );

    if (!approveRes.ok) {
      return NextResponse.json(
        {
          error: inkaiErrorMessage(
            approveData,
            "Pendaftaran dibuat tetapi gagal disetujui otomatis",
          ),
        },
        { status: approveRes.status },
      );
    }

    const approvedRegistration = (approveData.data as Record<string, unknown>) ?? registration;
    const member = approvedRegistration.member as { fullName?: string } | undefined;
    const event = approvedRegistration.event as { title?: string } | undefined;

    writeAuditLog({
      userId: authResult.user.id,
      email: authResult.user.email,
      action: "UKT_REGISTER",
      details: `Registered ${member?.fullName ?? memberId} for ${event?.title ?? eventId}`,
      ip: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      token: authResult.token,
    });

    await notifyUktStatusChange({
      token: authResult.token,
      memberId,
      memberName: String(member?.fullName ?? "Anggota"),
      periodTitle: String(event?.title ?? "UKT"),
      displayStatus: "belum_bayar",
      extra: "Silakan koordinasi pembayaran UKT dengan ketua ranting.",
    });

    const billings = (member as { billings?: Array<{ id: string }> } | undefined)?.billings;
    return NextResponse.json({
      success: true,
      registrationId: approvedRegistration.id ?? registrationId,
      billingId: billings?.[0]?.id ?? null,
    });
  } catch (error) {
    console.error("[UKT Register]", error);
    const message = error instanceof Error ? error.message : "Gagal mendaftarkan anggota";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
