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
import { getPrimaryAdminRole } from "@/lib/rbac";
import { validateUktRegistrationEligibility } from "@/lib/ukt-register";
import { notifyUktStatusChange } from "@/lib/ukt-notify";
import { notifyUktBranchAdmins } from "@/lib/ukt-period-notify";

export const maxDuration = 30;

type BillingRow = {
  id?: string;
  amount?: number;
  status?: string;
  registrationId?: string | null;
  type?: string;
  description?: string | null;
};

function pickBillingForRegistration(
  registrationId: string,
  billings: BillingRow[] | undefined,
): BillingRow | null {
  if (!billings?.length) return null;
  const linked = billings.find(
    (b) => b.id && String(b.registrationId ?? "") === registrationId,
  );
  if (linked) return linked;

  // Jangan ambil tagihan lunas lama — hanya terbuka (PENDING / menunggu verif)
  const open = billings.find((b) => {
    if (!b.id) return false;
    const rid = String(b.registrationId ?? "");
    if (rid && rid !== registrationId) return false;
    const st = String(b.status ?? "").toUpperCase();
    if (st === "PAID" || st === "SUCCESS" || st === "CANCELLED") return false;
    const type = String(b.type ?? "").toUpperCase();
    const desc = String(b.description ?? "").toUpperCase();
    return (
      type.includes("UKT") ||
      type === "EVENT" ||
      desc.includes("UKT") ||
      !rid
    );
  });
  return open ?? null;
}

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

    const primaryRole = getPrimaryAdminRole(authResult.user.roles);
    const eligibility = await validateUktRegistrationEligibility(
      authResult.token,
      eventId,
      memberId,
      { primaryRole },
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

    // Kunci Kyu Lama saat daftar (snapshot sabuk saat ini)
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

    const approvedRegistration =
      (approveData.data as Record<string, unknown>) ?? registration;
    const member = approvedRegistration.member as
      | {
          fullName?: string;
          billings?: BillingRow[];
        }
      | undefined;
    const event = approvedRegistration.event as { title?: string } | undefined;

    let billing = pickBillingForRegistration(
      registrationId,
      member?.billings,
    );

    // Pastikan ada tagihan periode ini (jangan pakai tagihan lunas lama)
    if (!billing) {
      const listRes = await inkaiFetch(
        `/v1/billing?memberId=${encodeURIComponent(memberId)}&limit=50`,
        {},
        authResult.token,
        { timeoutMs: 5_000, retries: 0 },
      );
      if (listRes.res.ok) {
        billing = pickBillingForRegistration(
          registrationId,
          (listRes.data.data as BillingRow[]) ?? [],
        );
      }
    }

    writeAuditLog({
      userId: authResult.user.id,
      email: authResult.user.email,
      action: "UKT_REGISTER",
      details: `Registered ${member?.fullName ?? memberId} for ${event?.title ?? eventId}`,
      ip: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      token: authResult.token,
    });

    const memberName = String(member?.fullName ?? "Anggota");
    const periodTitle = String(event?.title ?? "UKT");

    // Status awal setelah daftar ranting: Belum Bayar (bukan Menunggu Ujian)
    void notifyUktStatusChange({
      token: authResult.token,
      memberId,
      memberName,
      periodTitle,
      displayStatus: "belum_bayar",
      extra: "Silakan koordinasi pembayaran UKT dengan ketua ranting.",
    }).catch((err) => console.error("[UKT Register] notify member", err));

    // Cabang otomatis mendapat sinyal bila ranting mendaftarkan peserta
    if (primaryRole === "ADMIN_DOJO") {
      void notifyUktBranchAdmins({
        token: authResult.token,
        title: "UKT — Pendaftaran baru dari ranting",
        content: `${memberName} didaftarkan ke ${periodTitle}. Status: Belum Bayar — menunggu setoran/verifikasi cabang.`,
        actorEmail: authResult.user.email,
        type: "INFO",
      }).catch((err) => console.error("[UKT Register] notify cabang", err));
    }

    const billingStatus = billing?.status
      ? String(billing.status)
      : "PENDING";

    return NextResponse.json({
      success: true,
      registrationId: approvedRegistration.id ?? registrationId,
      billingId: billing?.id ?? null,
      billingAmount:
        billing?.amount != null && Number.isFinite(Number(billing.amount))
          ? Number(billing.amount)
          : null,
      billingStatus,
    });
  } catch (error) {
    console.error("[UKT Register]", error);
    const message = error instanceof Error ? error.message : "Gagal mendaftarkan anggota";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
