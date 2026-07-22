import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { inkaiFetch, inkaiErrorMessage } from "@/lib/inkai-api/server";
import { getPrimaryAdminRole } from "@/lib/rbac";
import { getManagedDojoIdsFromUser } from "@/lib/managed-dojos";
import {
  canEditKyuBaru,
  decodeUktRegisteredRank,
  encodeUktRegisteredRank,
  formatRankLabel,
  ranksEqual,
  isBlankUktRank,
  inferPreviousBeltRank,
  DEFAULT_MEMBER_RANK,
} from "@/lib/belt";
import { uktRegistrationUpdateSchema } from "@/lib/security/schemas";
import { writeAuditLog } from "@/lib/audit";
import { getClientIp } from "@/lib/security/request";
import { prisma } from "@/lib/prisma";
import { uktExamResultKey } from "@/lib/ukt";
import { notifyUktStatusChange } from "@/lib/ukt-notify";
import { notifyUktBranchAdmins } from "@/lib/ukt-period-notify";
import {
  deleteBillingsHard,
  forceDeleteRegistrationInDb,
  forceUnlinkBillingsInDb,
} from "@/lib/billing-delete";

type RouteContext = { params: Promise<{ id: string }> };

function mapActionToStatus(data: {
  action?: string;
  status?: string;
}): string | undefined {
  if (data.action === "approve" || data.status === "APPROVED") return "APPROVED";
  if (data.action === "reject" || data.status === "REJECTED") return "REJECTED";
  if (data.action === "mark_paid" || data.status === "PAID") return "APPROVED";
  if (data.status) return data.status;
  return undefined;
}

async function applyKyuBaruToMember(opts: {
  registrationId: string;
  newRank: string;
  token: string;
  memberIdHint?: string;
  previousRankHint?: string;
}): Promise<{
  ok: boolean;
  error?: string;
  status?: number;
  memberId?: string;
  kyuLama?: string;
  kyuBaru?: string;
  registration?: Record<string, unknown>;
}> {
  const kyuBaru = formatRankLabel(opts.newRank) || opts.newRank.trim();
  if (!kyuBaru) {
    return { ok: false, error: "Kyu Baru tidak valid", status: 400 };
  }

  let memberId = opts.memberIdHint?.trim() || "";
  let memberCurrentRank = "";
  let existingRegistered: string | null = null;
  let eventLocation: string | null = null;

  const { res: getRes, data: getData } = await inkaiFetch(
    `/v1/events/register/${opts.registrationId}`,
    {},
    opts.token,
  );

  if (getRes.ok) {
    const reg = getData.data as Record<string, unknown>;
    const member = reg.member as
      | { id?: string; currentRank?: string }
      | undefined;
    if (!memberId) memberId = String(member?.id ?? reg.memberId ?? "");
    memberCurrentRank = String(member?.currentRank ?? "");
    existingRegistered =
      typeof reg.registeredRank === "string" ? reg.registeredRank : null;
    const event = reg.event as { location?: string; title?: string } | undefined;
    eventLocation = event?.location || event?.title || null;
  }

  if (memberId && !memberCurrentRank) {
    const { res: mRes, data: mData } = await inkaiFetch(
      `/v1/members/${memberId}`,
      {},
      opts.token,
    );
    if (mRes.ok) {
      const member = mData.data as { currentRank?: string };
      memberCurrentRank = String(member?.currentRank ?? "");
    }
  }

  const decoded = decodeUktRegisteredRank(existingRegistered);
  const hintRaw = opts.previousRankHint?.trim() || "";
  const hint = formatRankLabel(hintRaw) || hintRaw;
  const fromMember =
    formatRankLabel(memberCurrentRank) || memberCurrentRank;

  // Kyu Lama dikunci dari sabuk keanggotaan saat apply (bukan infer dari Kyu Baru)
  let kyuLama =
    fromMember && !ranksEqual(fromMember, kyuBaru) ? fromMember : "";
  if (!kyuLama && decoded.kyuLama && !isBlankUktRank(decoded.kyuLama) && !ranksEqual(decoded.kyuLama, kyuBaru)) {
    kyuLama = decoded.kyuLama;
  }
  if (!kyuLama && hint && !ranksEqual(hint, kyuBaru) && !isBlankUktRank(hint)) {
    kyuLama = hint;
  }
  if (!kyuLama) {
    kyuLama = inferPreviousBeltRank(kyuBaru) || DEFAULT_MEMBER_RANK;
  }

  const registeredRank = encodeUktRegisteredRank(kyuLama, kyuBaru);

  const { res, data: apiData } = await inkaiFetch(
    `/v1/events/register/${opts.registrationId}`,
    {
      method: "PUT",
      body: JSON.stringify({
        registeredRank,
        status: "APPROVED",
      }),
    },
    opts.token,
  );

  if (!res.ok) {
    return {
      ok: false,
      error: inkaiErrorMessage(apiData, "Gagal menyimpan Kyu Baru"),
      status: res.status,
    };
  }

  const registration = (apiData.data as Record<string, unknown>) ?? {};
  if (!memberId) {
    const member = registration.member as { id?: string } | undefined;
    memberId = String(member?.id ?? registration.memberId ?? "");
  }

  if (!memberId) {
    return {
      ok: false,
      error: "Pendaftaran tersimpan, tetapi ID anggota tidak ditemukan",
      status: 500,
      registration,
    };
  }

  const { res: memberRes, data: memberData } = await inkaiFetch(
    `/v1/members/${memberId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ currentRank: kyuBaru }),
    },
    opts.token,
  );

  if (!memberRes.ok) {
    return {
      ok: false,
      error: inkaiErrorMessage(
        memberData,
        "Kyu Baru tersimpan di UKT, tetapi gagal memperbarui sabuk anggota",
      ),
      status: memberRes.status,
      memberId,
      kyuLama,
      kyuBaru,
      registration,
    };
  }

  try {
    await prisma.memberRank.create({
      data: {
        memberId,
        rank: kyuBaru,
        date: new Date(),
        location: eventLocation,
        isVerified: true,
      },
    });
  } catch (error) {
    console.error("[UKT applyKyuBaru] memberRank create failed", error);
    await inkaiFetch(
      `/v1/members/${memberId}/ranks`,
      {
        method: "POST",
        body: JSON.stringify({
          rank: kyuBaru,
          date: new Date().toISOString(),
          location: eventLocation,
          isVerified: true,
        }),
      },
      opts.token,
    );
  }

  return {
    ok: true,
    memberId,
    kyuLama,
    kyuBaru,
    registration,
  };
}

export async function PATCH(request: Request, context: RouteContext) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!authResult.token) {
    return NextResponse.json({ error: "Token tidak tersedia" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json();
  const parsed = uktRegistrationUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const data = parsed.data;
  const role = getPrimaryAdminRole(authResult.user.roles);
  const isCabang = canEditKyuBaru(authResult.user.roles);

  if (data.examResult) {
    if (!isCabang) {
      return NextResponse.json(
        { error: "Hanya admin cabang yang dapat mencatat hasil ujian" },
        { status: 403 },
      );
    }
    if (!data.eventId) {
      return NextResponse.json({ error: "eventId wajib untuk hasil ujian" }, { status: 400 });
    }

    const key = uktExamResultKey(data.eventId, id);
    const value = {
      result: data.examResult,
      at: new Date().toISOString(),
      by: authResult.user.email,
    };
    const { res, data: apiData } = await inkaiFetch(
      `/v1/settings/${encodeURIComponent(key)}`,
      {
        method: "PUT",
        body: JSON.stringify({ value }),
      },
      authResult.token,
    );
    if (!res.ok) {
      return NextResponse.json(
        { error: inkaiErrorMessage(apiData, "Gagal menyimpan hasil ujian") },
        { status: res.status },
      );
    }

    writeAuditLog({
      userId: authResult.user.id,
      email: authResult.user.email,
      action: "UKT_EXAM_RESULT",
      details: `UKT ${id}: hasil ${data.examResult}`,
      ip: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      token: authResult.token,
    });

    const { res: regRes, data: regData } = await inkaiFetch(
      `/v1/events/register/${id}`,
      {},
      authResult.token,
    );
    if (regRes.ok) {
      const reg = regData.data as Record<string, unknown>;
      const member = reg.member as { id?: string; fullName?: string } | undefined;
      const event = reg.event as { title?: string } | undefined;
      const memberId = String(member?.id ?? reg.memberId ?? "");
      if (memberId) {
        const displayStatus =
          data.examResult === "LULUS"
            ? "lulus"
            : data.examResult === "GAGAL"
              ? "gagal"
              : "mengulang";
        await notifyUktStatusChange({
          token: authResult.token,
          memberId,
          memberName: String(member?.fullName ?? "Anggota"),
          periodTitle: String(event?.title ?? "UKT"),
          displayStatus,
        });
      }
    }

    return NextResponse.json({ success: true, examResult: data.examResult });
  }

  if (data.action === "submit_for_verification") {
    const { res: getRes, data: getData } = await inkaiFetch(
      `/v1/events/register/${id}`,
      {},
      authResult.token,
    );
    if (!getRes.ok) {
      return NextResponse.json(
        { error: inkaiErrorMessage(getData, "Pendaftaran tidak ditemukan") },
        { status: getRes.status },
      );
    }

    const registration = getData.data as Record<string, unknown>;
    const member = registration.member as
      | {
          id?: string;
          fullName?: string;
          dojoId?: string;
          billings?: Array<{
            id: string;
            status: string;
            registrationId?: string | null;
            isDeleted?: boolean;
          }>;
        }
      | undefined;
    const event = registration.event as { title?: string } | undefined;
    const memberId = String(member?.id ?? registration.memberId ?? "");

    if (role === "ADMIN_DOJO") {
      const allowlist = getManagedDojoIdsFromUser(authResult.user);
      const dojoId = String(member?.dojoId ?? "");
      if (allowlist.length > 0 && dojoId && !allowlist.includes(dojoId)) {
        return NextResponse.json(
          { error: "Pendaftaran di luar ranting Anda" },
          { status: 403 },
        );
      }
    }

    const unpaid = (status: string) =>
      !["PAID", "SUCCESS", "APPROVED", "REJECTED", "CANCELLED"].includes(
        String(status).toUpperCase(),
      );

    let billingId =
      member?.billings?.find(
        (b) =>
          !b.isDeleted &&
          b.registrationId === id &&
          unpaid(b.status),
      )?.id ||
      member?.billings?.find((b) => !b.isDeleted && unpaid(b.status))?.id ||
      null;

    if (!billingId) {
      const local = await prisma.billing.findFirst({
        where: {
          registrationId: id,
          isDeleted: false,
          status: { notIn: ["PAID", "SUCCESS", "APPROVED", "REJECTED"] },
        },
        select: { id: true },
        orderBy: { createdAt: "desc" },
      });
      billingId = local?.id ?? null;
    }

    if (!billingId && memberId) {
      const localByMember = await prisma.billing.findFirst({
        where: {
          memberId,
          isDeleted: false,
          OR: [{ registrationId: id }, { registrationId: null }],
          status: { in: ["PENDING", "WAITING_VERIFICATION"] },
          type: { in: ["EVENT", "UKT"] },
        },
        select: { id: true },
        orderBy: { createdAt: "desc" },
      });
      billingId = localByMember?.id ?? null;
    }

    if (!billingId) {
      return NextResponse.json(
        {
          error:
            "Tagihan UKT belum tersedia. Hubungi admin cabang atau daftar ulang.",
        },
        { status: 400 },
      );
    }

    const status = "WAITING_VERIFICATION";
    const note = "Diajukan ranting — menunggu verifikasi cabang";
    let submitted = false;
    const attempts: Array<{
      path: string;
      method: "PATCH" | "POST";
      body: Record<string, unknown>;
    }> = [
      {
        path: `/v1/billing/${billingId}/status`,
        method: "PATCH",
        body: { status, adminNotes: note },
      },
      {
        path: `/v1/billing/${billingId}`,
        method: "PATCH",
        body: { status, adminNotes: note },
      },
      {
        path: "/v1/billing/pay",
        method: "POST",
        body: {
          billingId,
          status,
          paymentMethod: "CASH",
          proofUrl: "—",
          adminNotes: note,
        },
      },
    ];

    let lastError = "Gagal mengajukan verifikasi";
    let lastStatus = 400;
    for (const attempt of attempts) {
      const { res, data: apiData } = await inkaiFetch(
        attempt.path,
        { method: attempt.method, body: JSON.stringify(attempt.body) },
        authResult.token,
      );
      if (res.ok) {
        submitted = true;
        break;
      }
      lastError = inkaiErrorMessage(apiData, lastError);
      lastStatus = res.status;
      if (res.status !== 404 && res.status !== 405 && res.status !== 400) {
        break;
      }
    }

    if (!submitted) {
      try {
        const local = await prisma.billing.updateMany({
          where: {
            id: billingId,
            isDeleted: false,
            status: { notIn: ["PAID", "SUCCESS", "APPROVED"] },
          },
          data: { status },
        });
        if (local.count === 0) {
          return NextResponse.json(
            { error: lastError },
            { status: lastStatus },
          );
        }
      } catch {
        return NextResponse.json(
          { error: lastError },
          { status: lastStatus },
        );
      }
    }

    const memberName = String(member?.fullName ?? "Anggota");
    const periodTitle = String(event?.title ?? "UKT");
    void notifyUktBranchAdmins({
      token: authResult.token,
      title: "UKT — Menunggu verifikasi pembayaran",
      content: `${memberName} — ${periodTitle}. Ranting mengajukan Bayar UKT; mohon verifikasi di menu UKT.`,
      actorEmail: authResult.user.email,
      type: "INFO",
    }).catch((err) =>
      console.error("[UKT submit_for_verification] notify cabang", err),
    );

    void notifyUktStatusChange({
      token: authResult.token,
      memberId,
      memberName,
      periodTitle,
      displayStatus: "menunggu_verifikasi",
      extra: "Pembayaran diajukan ranting — menunggu verifikasi cabang.",
    }).catch((err) =>
      console.error("[UKT submit_for_verification] notify member", err),
    );

    writeAuditLog({
      userId: authResult.user.id,
      email: authResult.user.email,
      action: "UKT_SUBMIT_PAYMENT",
      details: `Submitted UKT payment for verification (reg=${id}, billing=${billingId})`,
      ip: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      token: authResult.token,
    });

    return NextResponse.json({
      success: true,
      billingId,
      billingStatus: status,
      message: "Diajukan ke cabang — menunggu verifikasi (belum lunas)",
    });
  }

  if (data.newRank && !isCabang) {
    return NextResponse.json(
      { error: "Kyu Baru hanya dapat diubah oleh admin cabang" },
      { status: 403 },
    );
  }

  if (data.action === "approve" || data.action === "reject" || data.status) {
    const canApprove = [
      "ADMINISTRATOR",
      "ADMIN_PUSAT",
      "ADMIN_PROVINCE",
      "ADMIN_BRANCH",
      "ADMIN",
    ].includes(role);
    if (!canApprove && data.action !== "reject") {
      return NextResponse.json(
        { error: "Hanya admin cabang yang dapat menyetujui pendaftaran" },
        { status: 403 },
      );
    }
  }

  // Cabang mengisi Kyu Baru = lulus UKT → update sabuk resmi anggota
  if (data.newRank) {
    if (!data.eventId) {
      return NextResponse.json(
        { error: "eventId wajib untuk mengisi sabuk target" },
        { status: 400 },
      );
    }

    const { res: settingRes, data: settingData } = await inkaiFetch(
      `/v1/settings/${encodeURIComponent(uktExamResultKey(data.eventId, id))}`,
      {},
      authResult.token,
    );
    if (!settingRes.ok) {
      return NextResponse.json(
        {
          error:
            "Hasil ujian belum dicatat. Tandai peserta LULUS terlebih dahulu sebelum mengisi sabuk target.",
        },
        { status: 400 },
      );
    }
    const val = (settingData.data as { value?: { result?: string } } | undefined)?.value;
    const examResult = String(val?.result ?? "").toUpperCase();
    if (examResult !== "LULUS") {
      return NextResponse.json(
        {
          error:
            "Sabuk target hanya dapat diisi setelah peserta ditandai Lulus ujian dan pembayaran lunas",
        },
        { status: 400 },
      );
    }

    const applied = await applyKyuBaruToMember({
      registrationId: id,
      newRank: data.newRank,
      token: authResult.token,
      memberIdHint: data.memberId,
      previousRankHint: data.previousRank,
    });

    if (!applied.ok) {
      return NextResponse.json(
        { error: applied.error || "Gagal menerapkan Kyu Baru" },
        { status: applied.status || 500 },
      );
    }

    writeAuditLog({
      userId: authResult.user.id,
      email: authResult.user.email,
      action: "UKT_KYU_BARU_APPLY",
      details: `UKT ${id}: ${applied.kyuLama} → ${applied.kyuBaru} (member ${applied.memberId})`,
      ip: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      token: authResult.token,
    });

    if (applied.memberId) {
      await notifyUktStatusChange({
        token: authResult.token,
        memberId: applied.memberId,
        memberName: String(
          (applied.registration?.member as { fullName?: string } | undefined)?.fullName ??
            "Anggota",
        ),
        periodTitle: String(
          (applied.registration?.event as { title?: string } | undefined)?.title ?? "UKT",
        ),
        displayStatus: "selesai",
        extra: `Sabuk resmi diperbarui ke ${applied.kyuBaru}.`,
      });
    }

    return NextResponse.json({
      success: true,
      registration: applied.registration,
      kyuLama: applied.kyuLama,
      kyuBaru: applied.kyuBaru,
      message: `Sabuk diperbarui: ${applied.kyuBaru}`,
    });
  }

  const patchBody: Record<string, unknown> = {};
  const status = mapActionToStatus(data);
  if (status) patchBody.status = status;

  if (data.categoryId) {
    patchBody.categoryId = data.categoryId;
  }

  const { res, data: apiData } = await inkaiFetch(
    `/v1/events/register/${id}`,
    {
      method: "PUT",
      body: JSON.stringify(patchBody),
    },
    authResult.token,
  );

  if (!res.ok) {
    return NextResponse.json(
      { error: inkaiErrorMessage(apiData, "Gagal memperbarui pendaftaran") },
      { status: res.status },
    );
  }

  if (data.action === "mark_paid") {
    const registration = apiData.data as Record<string, unknown>;
    const member = registration.member as
      | { id?: string; fullName?: string; billings?: Array<{ id: string; status: string }> }
      | undefined;
    const billing = member?.billings?.find((b) => b.status === "PENDING");
    if (billing) {
      await inkaiFetch(
        "/v1/billing/verify",
        {
          method: "POST",
          body: JSON.stringify({ billingId: billing.id, status: "PAID" }),
        },
        authResult.token,
      );
    }
    const memberId = String(member?.id ?? registration.memberId ?? "");
    const event = registration.event as { title?: string } | undefined;
    if (memberId) {
      await notifyUktStatusChange({
        token: authResult.token,
        memberId,
        memberName: String(member?.fullName ?? "Anggota"),
        periodTitle: String(event?.title ?? "UKT"),
        displayStatus: "menunggu_ujian",
        extra: "Pembayaran UKT telah diverifikasi.",
      });
    }
  }

  writeAuditLog({
    userId: authResult.user.id,
    email: authResult.user.email,
    action: "UKT_REGISTRATION_UPDATE",
    details: `Updated registration ${id}: ${JSON.stringify(data)}`,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    token: authResult.token,
  });

  return NextResponse.json({ success: true, registration: apiData.data });
}

export async function DELETE(request: Request, context: RouteContext) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!authResult.token) {
    return NextResponse.json({ error: "Token tidak tersedia" }, { status: 401 });
  }

  const token = authResult.token;
  const isCabang = canEditKyuBaru(authResult.user.roles);
  const primaryRole = getPrimaryAdminRole(authResult.user.roles);
  const isDojo = primaryRole === "ADMIN_DOJO";
  const canForcePaid = isCabang || isDojo;
  const { id } = await context.params;
  const url = new URL(request.url);
  const billingIdFromClient = url.searchParams.get("billingId")?.trim() || null;
  const memberIdFromClient = url.searchParams.get("memberId")?.trim() || null;
  const forceRequested =
    url.searchParams.get("force") === "1" ||
    url.searchParams.get("force") === "true";

  const billingIds = new Set<string>();
  if (billingIdFromClient) billingIds.add(billingIdFromClient);

  let memberId = memberIdFromClient || "";
  let memberDojoId = "";
  let memberName = "";
  let periodTitle = "UKT";
  let sawPaid = false;

  type BillingRow = {
    id?: string;
    status?: string;
    registrationId?: string | null;
    type?: string;
    description?: string | null;
  };

  function considerBilling(b: BillingRow | null | undefined) {
    if (!b?.id) return;
    billingIds.add(String(b.id));
    const st = String(b.status ?? "").toUpperCase();
    if (st === "PAID" || st === "SUCCESS" || st === "APPROVED") sawPaid = true;
  }

  function isUktish(b: BillingRow) {
    const type = String(b.type ?? "").toUpperCase();
    const desc = String(b.description ?? "").toUpperCase();
    return type.includes("UKT") || desc.includes("UKT");
  }

  const { res: getRes, data: getData } = await inkaiFetch(
    `/v1/events/register/${id}`,
    {},
    token,
    { timeoutMs: 5_000, retries: 0 },
  );
  if (getRes.ok) {
    const registration = (getData.data as Record<string, unknown>) ?? {};
    const member = registration.member as
      | {
          id?: string;
          fullName?: string;
          dojoId?: string;
          dojo?: { id?: string };
          billings?: BillingRow[];
        }
      | undefined;
    if (!memberId) memberId = String(member?.id ?? registration.memberId ?? "");
    memberDojoId = String(
      member?.dojoId ?? member?.dojo?.id ?? registration.dojoId ?? "",
    );
    memberName = String(member?.fullName ?? "Anggota");
    const event = registration.event as { title?: string } | undefined;
    periodTitle = String(event?.title ?? "UKT");
    for (const b of member?.billings ?? []) {
      if (String(b.registrationId ?? "") === id || isUktish(b) || !b.registrationId) {
        considerBilling(b);
      }
    }
  }

  if (isDojo) {
    const allowlist = getManagedDojoIdsFromUser(authResult.user);
    if (allowlist.length > 0) {
      if (!memberDojoId && memberId) {
        try {
          const local = await prisma.member.findFirst({
            where: { id: memberId, isDeleted: false },
            select: { dojoId: true, fullName: true },
          });
          if (local?.dojoId) memberDojoId = local.dojoId;
          if (local?.fullName) memberName = local.fullName;
        } catch {
          /* ignore */
        }
      }
      if (memberDojoId && !allowlist.includes(memberDojoId)) {
        return NextResponse.json(
          { error: "Peserta di luar ranting Anda" },
          { status: 403 },
        );
      }
    }
  }

  async function collectMemberBillings(mid: string) {
    const { res, data } = await inkaiFetch(
      `/v1/billing?memberId=${encodeURIComponent(mid)}&limit=100`,
      {},
      token,
      { timeoutMs: 5_000, retries: 0 },
    );
    if (!res.ok) return [] as BillingRow[];
    return (data.data as BillingRow[]) ?? [];
  }

  if (memberId) {
    const list = await collectMemberBillings(memberId);
    for (const b of list) {
      if (String(b.registrationId ?? "") === id || isUktish(b)) {
        considerBilling(b);
      }
    }
  }

  try {
    const locals = await prisma.billing.findMany({
      where: {
        isDeleted: false,
        OR: [
          { registrationId: id },
          ...(billingIdFromClient ? [{ id: billingIdFromClient }] : []),
          ...(memberId
            ? [{ memberId, status: { in: ["PAID", "SUCCESS", "APPROVED"] } }]
            : []),
        ],
      },
      select: { id: true, status: true },
      take: 50,
    });
    for (const local of locals) {
      considerBilling(local);
    }
  } catch (error) {
    console.error("[UKT DELETE] prisma billing lookup failed", error);
  }

  const force = forceRequested || sawPaid || canForcePaid;
  const FAST = { timeoutMs: 5_000, retries: 0 as const };

  if ((forceRequested || sawPaid) && !canForcePaid) {
    return NextResponse.json(
      { error: "Anda tidak berwenang membatalkan peserta yang tagihannya sudah lunas" },
      { status: 403 },
    );
  }

  if (billingIds.size > 0) {
    await deleteBillingsHard(token, billingIds, {
      continueOnFailure: Boolean(force && canForcePaid),
    });
  }

  async function tryDeleteRegistration(): Promise<{
    ok: boolean;
    error: string;
    status: number;
  }> {
    // Coba force dulu (1x), lalu plain — jangan 3 path berantai
    const registerPaths = force
      ? [`/v1/events/register/${id}?force=true`, `/v1/events/register/${id}`]
      : [`/v1/events/register/${id}`];

    let regError = "Gagal membatalkan pendaftaran";
    let regStatus = 400;
    for (const path of registerPaths) {
      const { res, data } = await inkaiFetch(
        path,
        { method: "DELETE" },
        token,
        FAST,
      );
      if (res.ok || res.status === 404) return { ok: true, error: "", status: 200 };
      regError = inkaiErrorMessage(data, regError);
      regStatus = res.status;
      // Jika bukan blokir lunas, jangan coba path lain
      if (!/tagihan.*lunas|sudah lunas/i.test(regError)) break;
    }
    return { ok: false, error: regError, status: regStatus };
  }

  let regResult = await tryDeleteRegistration();

  let looksPaidBlock =
    /tagihan.*lunas|sudah lunas|billing.*paid|paid.*billing/i.test(regResult.error);

  if (!regResult.ok && canForcePaid && looksPaidBlock && memberId) {
    const list = await collectMemberBillings(memberId);
    const retryIds = new Set<string>();
    for (const b of list) {
      if (!b.id) continue;
      if (String(b.registrationId ?? "") === id || isUktish(b)) {
        retryIds.add(String(b.id));
        considerBilling(b);
      }
    }
    if (retryIds.size === 0) {
      for (const b of list) {
        if (!b.id) continue;
        const st = String(b.status ?? "").toUpperCase();
        const rid = String(b.registrationId ?? "");
        if (
          (st === "PAID" || st === "SUCCESS" || st === "APPROVED") &&
          (!rid || rid === id)
        ) {
          retryIds.add(String(b.id));
          considerBilling(b);
        }
      }
    }
    if (retryIds.size > 0) {
      await deleteBillingsHard(token, retryIds, { continueOnFailure: true });
      regResult = await tryDeleteRegistration();
      looksPaidBlock =
        /tagihan.*lunas|sudah lunas|billing.*paid|paid.*billing/i.test(
          regResult.error,
        );
    }
  }

  // Cabang/ranting force: API gagal (blokir lunas) → putuskan di shared DB
  let usedDbForce = false;
  if (!regResult.ok && canForcePaid && (looksPaidBlock || forceRequested || sawPaid)) {
    if (billingIds.size > 0) {
      const unlink = await forceUnlinkBillingsInDb(billingIds);
      if (!unlink.ok) {
        return NextResponse.json(
          { error: unlink.error || "Gagal memutus tagihan di database" },
          { status: 500 },
        );
      }
    }
    const dbDelete = await forceDeleteRegistrationInDb(id);
    if (!dbDelete.ok) {
      return NextResponse.json(
        {
          error:
            dbDelete.error ||
            "Gagal menghapus pendaftaran di database setelah API menolak",
        },
        { status: 500 },
      );
    }
    usedDbForce = true;
    regResult = { ok: true, error: "", status: 200 };
  }

  if (!regResult.ok) {
    return NextResponse.json(
      {
        error:
          billingIds.size > 0
            ? `Tagihan sudah diproses, tetapi pendaftaran gagal dihapus: ${regResult.error}`
            : regResult.error,
      },
      { status: regResult.status },
    );
  }

  if (billingIds.size > 0 && !usedDbForce) {
    try {
      await prisma.billing.updateMany({
        where: { id: { in: [...billingIds] } },
        data: { isDeleted: true },
      });
    } catch {
      /* ignore */
    }
  }

  writeAuditLog({
    userId: authResult.user.id,
    email: authResult.user.email,
    action: "UKT_REGISTRATION_CANCEL",
    details: `Cancelled UKT registration (${id})${
      billingIds.size ? ` and deleted billings (${[...billingIds].join(",")})` : ""
    }${force ? " [force]" : ""}${usedDbForce ? " [db-force]" : ""}${
      isDojo ? " [ranting]" : ""
    }`,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    token,
  });

  if (isDojo) {
    void notifyUktBranchAdmins({
      token,
      title: "UKT — Pembatalan dari ranting",
      content: `${memberName} dibatalkan dari ${periodTitle}${
        sawPaid ? " (termasuk tagihan yang sudah lunas)" : ""
      }.`,
      actorEmail: authResult.user.email,
      type: "WARNING",
    }).catch((err) => console.error("[UKT DELETE] notify cabang", err));
  }

  return NextResponse.json({
    success: true,
    message:
      billingIds.size > 0 || usedDbForce
        ? "Pendaftaran dan tagihan UKT berhasil dihapus"
        : "Pendaftaran dibatalkan",
  });
}
