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
import { getManagedDojoIdsFromUser } from "@/lib/managed-dojos";
import { prisma } from "@/lib/prisma";
import {
  forceRegisterUktInDb,
  isInkaiScopeDeniedError,
  resolveUktRegisterFeeAmount,
  validateUktRegistrationEligibility,
} from "@/lib/ukt-register";
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

async function loadScopedMemberForRegister(
  user: Parameters<typeof getManagedDojoIdsFromUser>[0],
  memberId: string,
  primaryRole: string,
) {
  const allowlist =
    primaryRole === "ADMIN_DOJO" ? getManagedDojoIdsFromUser(user) : [];
  return prisma.member.findFirst({
    where: {
      id: memberId,
      isDeleted: false,
      ...(allowlist.length > 0 ? { dojoId: { in: allowlist } } : {}),
    },
    select: {
      id: true,
      fullName: true,
      currentRank: true,
      dojoId: true,
    },
  });
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

    // Pastikan anggota dalam cakupan ranting (Prisma) sebelum daftar / fallback DB
    const scopedMember = await loadScopedMemberForRegister(
      authResult.user,
      memberId,
      primaryRole,
    );
    if (!scopedMember) {
      return NextResponse.json(
        {
          error:
            primaryRole === "ADMIN_DOJO"
              ? "Anggota di luar ranting Anda"
              : "Anggota tidak ditemukan",
        },
        { status: 403 },
      );
    }

    let kyuLamaSnapshot =
      formatRankLabel(scopedMember.currentRank) ||
      scopedMember.currentRank ||
      DEFAULT_MEMBER_RANK;
    if (!kyuLamaSnapshot) kyuLamaSnapshot = DEFAULT_MEMBER_RANK;
    const registeredRankEncoded = encodeUktRegisteredRank(kyuLamaSnapshot, "");

    let { res, data } = await inkaiFetch(
      "/v1/events/register",
      {
        method: "POST",
        body: JSON.stringify({ eventId, memberId }),
      },
      authResult.token,
    );

    // Token ranting sering ditolak Inkai (multi-dojo / scope) → service token, lalu Prisma
    if (!res.ok) {
      const inkaiMsg = inkaiErrorMessage(data, "Gagal mendaftarkan anggota");
      const scopeDenied =
        isInkaiScopeDeniedError(inkaiMsg, res.status) ||
        /tidak ditemukan|not found/i.test(inkaiMsg);

      if (scopeDenied) {
        const serviceToken =
          process.env.INKAI_SERVICE_TOKEN || process.env.CRON_INKAI_TOKEN;
        if (serviceToken) {
          const retry = await inkaiFetch(
            "/v1/events/register",
            {
              method: "POST",
              body: JSON.stringify({ eventId, memberId }),
            },
            serviceToken,
          );
          if (retry.res.ok) {
            res = retry.res;
            data = retry.data;
          }
        }
      }

      if (!res.ok && scopeDenied) {
        const periodTitle = "UKT";
        const amount = await resolveUktRegisterFeeAmount({
          token: authResult.token,
          eventId,
          memberRank: kyuLamaSnapshot,
        });
        const dbReg = await forceRegisterUktInDb({
          eventId,
          memberId,
          registeredByUserId: authResult.user.id,
          kyuLamaSnapshot: registeredRankEncoded,
          periodTitle,
          amount,
        });
        if (!dbReg.ok) {
          return NextResponse.json({ error: dbReg.error }, { status: 400 });
        }

        writeAuditLog({
          userId: authResult.user.id,
          email: authResult.user.email,
          action: "UKT_REGISTER",
          details: `Registered ${dbReg.memberName} for ${eventId} [db-fallback]`,
          ip: getClientIp(request),
          userAgent: request.headers.get("user-agent"),
          token: authResult.token,
        });

        void notifyUktStatusChange({
          token: authResult.token,
          memberId,
          memberName: dbReg.memberName,
          periodTitle,
          displayStatus: "belum_bayar",
          extra: "Silakan koordinasi pembayaran UKT dengan ketua ranting.",
        }).catch((err) => console.error("[UKT Register] notify member", err));

        if (primaryRole === "ADMIN_DOJO") {
          void notifyUktBranchAdmins({
            token: authResult.token,
            title: "UKT — Pendaftaran baru dari ranting",
            content: `${dbReg.memberName} didaftarkan ke periode UKT. Status: Belum Bayar — menunggu setoran/verifikasi cabang.`,
            actorEmail: authResult.user.email,
            type: "INFO",
          }).catch((err) => console.error("[UKT Register] notify cabang", err));
        }

        return NextResponse.json({
          success: true,
          registrationId: dbReg.registrationId,
          billingId: dbReg.billingId,
          billingAmount: dbReg.billingAmount,
          billingStatus: dbReg.billingStatus,
        });
      }

      if (!res.ok) {
        const message = inkaiErrorMessage(data, "Gagal mendaftarkan anggota");
        const status = message.toLowerCase().includes("already") ? 409 : res.status;
        return NextResponse.json({ error: message }, { status });
      }
    }

    const registration = data.data as Record<string, unknown>;
    const registrationId = String(registration.id);

    const regMember = registration.member as { currentRank?: string } | undefined;
    if (regMember?.currentRank) {
      kyuLamaSnapshot =
        formatRankLabel(regMember.currentRank) || regMember.currentRank;
    }

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
      // Approve gagal karena scope — coba service token, atau patch Prisma
      const approveMsg = inkaiErrorMessage(
        approveData,
        "Pendaftaran dibuat tetapi gagal disetujui otomatis",
      );
      let approved = false;
      if (isInkaiScopeDeniedError(approveMsg, approveRes.status)) {
        const serviceToken =
          process.env.INKAI_SERVICE_TOKEN || process.env.CRON_INKAI_TOKEN;
        if (serviceToken) {
          const retryApprove = await inkaiFetch(
            `/v1/events/register/${registrationId}`,
            {
              method: "PUT",
              body: JSON.stringify({
                status: "APPROVED",
                registeredRank: encodeUktRegisteredRank(kyuLamaSnapshot, ""),
              }),
            },
            serviceToken,
          );
          if (retryApprove.res.ok) {
            approved = true;
            Object.assign(approveData, retryApprove.data);
          }
        }
        if (!approved) {
          try {
            await prisma.eventRegistration.update({
              where: { id: registrationId },
              data: {
                status: "APPROVED",
                registeredRank: encodeUktRegisteredRank(kyuLamaSnapshot, ""),
              },
            });
            approved = true;
          } catch (error) {
            console.error("[UKT Register] prisma approve fallback failed", error);
          }
        }
      }
      if (!approved) {
        return NextResponse.json(
          { error: approveMsg },
          { status: approveRes.status },
        );
      }
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

    // Inkai register OK tapi billing kosong (scope) — buat tagihan di Prisma
    if (!billing?.id) {
      const amount = await resolveUktRegisterFeeAmount({
        token: authResult.token,
        eventId,
        memberRank: kyuLamaSnapshot,
      });
      const periodTitle = String(event?.title ?? "UKT");
      try {
        const created = await prisma.billing.create({
          data: {
            memberId,
            registrationId,
            type: "EVENT",
            amount,
            baseFeeAmount: amount,
            description: `UKT — ${periodTitle}`,
            dueDate: new Date(),
            status: "PENDING",
            isDeleted: false,
          },
        });
        billing = {
          id: created.id,
          amount: created.amount,
          status: created.status,
          registrationId,
          type: created.type,
          description: created.description,
        };
      } catch (error) {
        console.error("[UKT Register] prisma billing create failed", error);
      }
    }

    writeAuditLog({
      userId: authResult.user.id,
      email: authResult.user.email,
      action: "UKT_REGISTER",
      details: `Registered ${member?.fullName ?? scopedMember.fullName} for ${event?.title ?? eventId}`,
      ip: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      token: authResult.token,
    });

    const memberName = String(
      member?.fullName ?? scopedMember.fullName ?? "Anggota",
    );
    const periodTitle = String(event?.title ?? "UKT");

    void notifyUktStatusChange({
      token: authResult.token,
      memberId,
      memberName,
      periodTitle,
      displayStatus: "belum_bayar",
      extra: "Silakan koordinasi pembayaran UKT dengan ketua ranting.",
    }).catch((err) => console.error("[UKT Register] notify member", err));

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
