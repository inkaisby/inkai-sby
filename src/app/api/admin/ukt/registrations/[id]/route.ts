import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { inkaiFetch, inkaiErrorMessage } from "@/lib/inkai-api/server";
import { getPrimaryAdminRole } from "@/lib/rbac";
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

  // Kyu Lama dikunci: snapshot lama > hint UI (bila bukan kyu baru) > sabuk anggota (bila belum naik)
  let kyuLama =
    decoded.kyuLama && !isBlankUktRank(decoded.kyuLama) ? decoded.kyuLama : "";
  if (!kyuLama && hint && !ranksEqual(hint, kyuBaru) && !isBlankUktRank(hint)) {
    kyuLama = hint;
  }
  if (!kyuLama && fromMember && !ranksEqual(fromMember, kyuBaru)) {
    kyuLama = fromMember;
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

  const isCabang = canEditKyuBaru(authResult.user.roles);
  const { id } = await context.params;
  const url = new URL(request.url);
  const billingIdFromClient = url.searchParams.get("billingId")?.trim() || null;
  const forceRequested =
    url.searchParams.get("force") === "1" ||
    url.searchParams.get("force") === "true";

  let billingId: string | null = billingIdFromClient;
  let billingStatus: string | null = null;
  let memberId = "";

  const { res: getRes, data: getData } = await inkaiFetch(
    `/v1/events/register/${id}`,
    {},
    authResult.token,
  );
  if (getRes.ok) {
    const registration = (getData.data as Record<string, unknown>) ?? {};
    const member = registration.member as
      | {
          id?: string;
          billings?: Array<{
            id?: string;
            status?: string;
            registrationId?: string | null;
            type?: string;
            description?: string | null;
          }>;
        }
      | undefined;
    memberId = String(member?.id ?? registration.memberId ?? "");
    const billings = member?.billings ?? [];
    const linkedBilling =
      billings.find((billing) => String(billing.registrationId ?? "") === id) ??
      billings.find((billing) => String(billing.id ?? "") === String(billingIdFromClient ?? "")) ??
      null;
    if (!billingId && linkedBilling?.id) billingId = String(linkedBilling.id);
    if (linkedBilling?.status) billingStatus = String(linkedBilling.status);
  }

  // Fallback: daftar tagihan anggota dari Inkai
  if ((!billingId || !billingStatus) && memberId) {
    const { res: billListRes, data: billListData } = await inkaiFetch(
      `/v1/billing?memberId=${encodeURIComponent(memberId)}&limit=100`,
      {},
      authResult.token,
    );
    if (billListRes.ok) {
      const list =
        (billListData.data as Array<{
          id?: string;
          status?: string;
          registrationId?: string | null;
          type?: string;
          description?: string | null;
        }>) ?? [];
      const linked =
        list.find((b) => String(b.registrationId ?? "") === id) ??
        (billingIdFromClient
          ? list.find((b) => String(b.id ?? "") === billingIdFromClient)
          : null) ??
        list.find((b) => {
          const type = String(b.type ?? "").toUpperCase();
          const desc = String(b.description ?? "").toUpperCase();
          return type.includes("UKT") || desc.includes("UKT");
        }) ??
        null;
      if (linked?.id) {
        billingId = String(linked.id);
        billingStatus = linked.status ? String(linked.status) : billingStatus;
      }
    }
  }

  // Fallback lokal Prisma
  if (!billingId) {
    try {
      const local = await prisma.billing.findFirst({
        where: { registrationId: id, isDeleted: false },
        select: { id: true, status: true },
      });
      if (local) {
        billingId = local.id;
        billingStatus = local.status;
      }
    } catch (error) {
      console.error("[UKT DELETE] prisma billing lookup failed", error);
    }
  } else if (!billingStatus) {
    try {
      const local = await prisma.billing.findFirst({
        where: { id: billingId },
        select: { status: true },
      });
      if (local?.status) billingStatus = local.status;
    } catch {
      /* ignore */
    }
  }

  const isPaid =
    billingStatus === "PAID" ||
    billingStatus === "SUCCESS" ||
    billingStatus === "APPROVED";
  const force = forceRequested || isPaid;

  if (force && !isCabang) {
    return NextResponse.json(
      { error: "Hanya admin cabang yang dapat menghapus paksa peserta lunas" },
      { status: 403 },
    );
  }

  async function deleteBillingHard(targetBillingId: string): Promise<{
    ok: boolean;
    error?: string;
    status?: number;
  }> {
    const attempts = [
      `/v1/billing/${targetBillingId}?force=true`,
      `/v1/billing/${targetBillingId}?force=1`,
      `/v1/billing/${targetBillingId}`,
    ];

    let lastError = "Gagal menghapus tagihan UKT terkait";
    let lastStatus = 400;

    for (const path of attempts) {
      const { res, data } = await inkaiFetch(
        path,
        { method: "DELETE" },
        authResult.token,
      );
      if (res.ok || res.status === 404) return { ok: true };
      lastError = inkaiErrorMessage(data, lastError);
      lastStatus = res.status;
    }

    // Soft-void lewat PATCH bila DELETE ditolak untuk tagihan lunas
    const patchAttempts = [
      { isDeleted: true },
      { status: "CANCELLED", isDeleted: true },
      { status: "REJECTED" },
    ];
    for (const body of patchAttempts) {
      const { res } = await inkaiFetch(
        `/v1/billing/${targetBillingId}`,
        { method: "PATCH", body: JSON.stringify(body) },
        authResult.token,
      );
      if (res.ok) {
        const { res: delRes } = await inkaiFetch(
          `/v1/billing/${targetBillingId}?force=true`,
          { method: "DELETE" },
          authResult.token,
        );
        if (delRes.ok || delRes.status === 404) return { ok: true };
        // PATCH sukses sudah memutus tautan operasional — lanjut hapus registrasi
        return { ok: true };
      }
    }

    try {
      await prisma.billing.updateMany({
        where: { id: targetBillingId },
        data: { isDeleted: true },
      });
    } catch (error) {
      console.error("[UKT DELETE] local billing soft-delete failed", error);
    }

    // Saat force cabang: jangan blokir total — tetap coba hapus registrasi
    if (force) return { ok: true };
    return { ok: false, error: lastError, status: lastStatus };
  }

  if (billingId) {
    const billingDelete = await deleteBillingHard(billingId);
    if (!billingDelete.ok) {
      return NextResponse.json(
        {
          error:
            billingDelete.error ||
            "Tidak dapat menghapus tagihan UKT terkait sebelum membatalkan pendaftaran",
        },
        { status: billingDelete.status || 400 },
      );
    }
  }

  const registerPaths = force
    ? [
        `/v1/events/register/${id}?force=true`,
        `/v1/events/register/${id}?force=1`,
        `/v1/events/register/${id}`,
      ]
    : [`/v1/events/register/${id}`];

  let regError = "Gagal membatalkan pendaftaran";
  let regStatus = 400;
  let regOk = false;

  for (const path of registerPaths) {
    const { res, data } = await inkaiFetch(
      path,
      { method: "DELETE" },
      authResult.token,
    );
    if (res.ok || res.status === 404) {
      regOk = true;
      break;
    }
    regError = inkaiErrorMessage(data, regError);
    regStatus = res.status;
  }

  if (!regOk) {
    return NextResponse.json(
      {
        error: billingId
          ? `Tagihan UKT sudah diproses, tetapi pendaftaran gagal dihapus: ${regError}`
          : regError,
      },
      { status: regStatus },
    );
  }

  if (billingId) {
    try {
      await prisma.billing.updateMany({
        where: { id: billingId },
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
      billingId ? ` and deleted billing (${billingId})` : ""
    }${force ? " [force]" : ""}`,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    token: authResult.token,
  });

  return NextResponse.json({
    success: true,
    message: billingId
      ? "Pendaftaran dan tagihan UKT berhasil dihapus"
      : "Pendaftaran dibatalkan",
  });
}
