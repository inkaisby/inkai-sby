import { inkaiFetch } from "@/lib/inkai-api/server";
import { prisma } from "@/lib/prisma";
import {
  buildUktSemesterWindow,
  buildUktWaiverMap,
  computeSemesterAttendance,
  formatUktRegistrationBlockers,
  getUktRegistrationBlockersWithWaiver,
  getUktRegistrationDeadline,
  getUktRegistrationOpenAt,
  isUktRegistrationNotYetOpen,
  isUktRegistrationOpen,
  parseUktEventTitle,
  parseUktPeriodMetaValue,
  uktPeriodMetaKey,
  uktRegistrationWaiverKey,
  type UktSemester,
} from "@/lib/ukt";
import {
  getUktRegistrationPolicy,
  resolveUktMemberRequirementFlags,
} from "@/lib/ukt-registration-policy";

async function fetchMemberAttendancePct(
  token: string,
  memberId: string,
  semester: UktSemester,
  year: number,
): Promise<{ ok: true; pct: number } | { ok: false }> {
  const qs = new URLSearchParams({
    memberId,
    limit: "120",
  });
  let { res, data } = await inkaiFetch(`/v1/attendance?${qs}`, {}, token);
  if (!res.ok) {
    const { semesterStart, semesterEnd } = buildUktSemesterWindow(semester, year);
    ({ res, data } = await inkaiFetch(
      `/v1/attendance?limit=800&from=${encodeURIComponent(semesterStart.toISOString())}&to=${encodeURIComponent(semesterEnd.toISOString())}`,
      {},
      token,
    ));
  }
  if (!res.ok) return { ok: false };

  const logs = ((data.data as Array<Record<string, unknown>>) ?? []).map((log) => {
    const m = log.member as { id?: string } | undefined;
    return {
      checkInAt: String(log.checkInAt ?? log.createdAt ?? ""),
      memberId: String(m?.id ?? log.memberId ?? ""),
    };
  });
  const { pctByMember } = computeSemesterAttendance(logs, semester, year);
  return { ok: true, pct: pctByMember.get(memberId) ?? 0 };
}

/**
 * Ambil anggota untuk gate daftar UKT.
 * Inkai GET by-id sering 404 untuk token ranting / setelah force-hapus tagihan
 * menandai soft-delete — fallback Prisma (+ pulihkan isDeleted bila perlu).
 */
async function resolveMemberForUktRegister(
  token: string,
  memberId: string,
): Promise<
  | { ok: true; member: Record<string, unknown> }
  | { ok: false; error: string }
> {
  const { res, data } = await inkaiFetch(`/v1/members/${memberId}`, {}, token);
  if (res.ok) {
    return { ok: true, member: (data.data as Record<string, unknown>) ?? {} };
  }

  let local: {
    id: string;
    isDeleted: boolean;
    status: string;
    fullName: string;
    currentRank: string;
    birthCertificateUrl: string | null;
    bpjsCardUrl: string | null;
  } | null = null;

  try {
    local = await prisma.member.findFirst({
      where: { id: memberId },
      select: {
        id: true,
        isDeleted: true,
        status: true,
        fullName: true,
        currentRank: true,
        birthCertificateUrl: true,
        bpjsCardUrl: true,
      },
    });
  } catch (error) {
    console.error("[ukt-register] prisma member lookup failed", error);
  }

  if (!local) {
    return { ok: false, error: "Anggota tidak ditemukan" };
  }

  // Hapus peserta UKT tidak boleh mengarsipkan anggota — pulihkan agar daftar ulang.
  if (local.isDeleted) {
    const restoreStatus =
      local.status === "INACTIVE" || local.status === "Inactive"
        ? local.status
        : "Active";
    try {
      await prisma.member.update({
        where: { id: memberId },
        data: { isDeleted: false, status: restoreStatus },
      });
      await inkaiFetch(
        `/v1/members/${memberId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ isDeleted: false, status: restoreStatus }),
        },
        token,
        { timeoutMs: 5_000, retries: 0 },
      );
      console.warn(
        "[ukt-register] restored soft-deleted member for re-register",
        memberId,
      );
    } catch (error) {
      console.error("[ukt-register] restore soft-deleted member failed", error);
      return {
        ok: false,
        error:
          "Anggota terarsip setelah hapus UKT. Minta cabang pulihkan di Kelola Anggota, lalu daftar ulang.",
      };
    }
  }

  // Coba ulang Inkai setelah restore; jika tetap gagal pakai data Prisma.
  const retry = await inkaiFetch(`/v1/members/${memberId}`, {}, token);
  if (retry.res.ok) {
    return {
      ok: true,
      member: (retry.data.data as Record<string, unknown>) ?? {},
    };
  }

  return {
    ok: true,
    member: {
      id: local.id,
      fullName: local.fullName,
      currentRank: local.currentRank,
      status: local.isDeleted ? "Active" : local.status,
      birthCertificateUrl: local.birthCertificateUrl,
      bpjsCardUrl: local.bpjsCardUrl,
    },
  };
}

export async function validateUktRegistrationEligibility(
  token: string,
  eventId: string,
  memberId: string,
  opts?: {
    primaryRole?: string;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const primaryRole = opts?.primaryRole ?? "ADMIN_BRANCH";
  const policy = await getUktRegistrationPolicy();
  const req = resolveUktMemberRequirementFlags(policy, primaryRole);
  const skipMemberRequirements =
    !req.requireNoOutstandingDues &&
    !req.requireDocuments &&
    !req.requireMinAttendance;

  const [
    { res: eventRes, data: eventData },
    memberResolved,
    billingsScoped,
    waiverRes,
    metaRes,
  ] = await Promise.all([
    inkaiFetch(`/v1/events/${eventId}`, {}, token),
    resolveMemberForUktRegister(token, memberId),
    skipMemberRequirements || !req.requireNoOutstandingDues
      ? Promise.resolve({
          res: { ok: true } as Response,
          data: { data: [] as unknown[] },
        })
      : inkaiFetch(
          `/v1/billing?memberId=${encodeURIComponent(memberId)}&limit=100`,
          {},
          token,
        ),
    inkaiFetch(
      `/v1/settings/${encodeURIComponent(uktRegistrationWaiverKey(eventId, memberId))}`,
      {},
      token,
    ),
    inkaiFetch(
      `/v1/settings/${encodeURIComponent(uktPeriodMetaKey(eventId))}`,
      {},
      token,
    ),
  ]);

  if (!eventRes.ok) {
    return { ok: false, error: "Periode UKT tidak ditemukan" };
  }
  if (!memberResolved.ok) {
    return { ok: false, error: memberResolved.error };
  }

  let billingsRes = billingsScoped;
  if (req.requireNoOutstandingDues && !billingsRes.res.ok) {
    billingsRes = await inkaiFetch("/v1/billing?limit=250", {}, token);
  }
  if (req.requireNoOutstandingDues && !billingsRes.res.ok) {
    return {
      ok: false,
      error: "Gagal memverifikasi status iuran. Coba lagi.",
    };
  }

  const event = eventData.data as Record<string, unknown>;
  const member = memberResolved.member;
  const periodMeta = parseUktPeriodMetaValue(
    metaRes.res.ok
      ? ((metaRes.data.data as { value?: unknown })?.value ?? null)
      : null,
  );
  const schedule = {
    startDate: String(event.startDate),
    endDate: String(event.endDate),
    registrationCloseAt: event.registrationCloseAt
      ? String(event.registrationCloseAt)
      : null,
    registrationOpenAt: periodMeta.registrationOpenAt ?? null,
  };
  const registrationOpen = isUktRegistrationOpen(schedule);
  const registrationNotYetOpen = isUktRegistrationNotYetOpen(schedule);

  let outstandingDues = 0;
  if (req.requireNoOutstandingDues) {
    const billings = (billingsRes.data.data as Array<Record<string, unknown>>) ?? [];
    for (const b of billings) {
      if (String(b.memberId) !== memberId) continue;
      const status = String(b.status ?? "");
      if (status === "PENDING" || status === "WAITING_VERIFICATION") {
        outstandingDues++;
      }
    }
  }

  const title = String(event.title ?? "");
  const parsed = parseUktEventTitle(title);
  const semester = (parsed?.semester ?? "I") as UktSemester;
  const year = parsed?.year ?? new Date().getFullYear();

  let attendancePct = 100;
  if (req.requireMinAttendance) {
    const attendance = await fetchMemberAttendancePct(token, memberId, semester, year);
    if (!attendance.ok) {
      return {
        ok: false,
        error: "Gagal memverifikasi kehadiran semester. Coba lagi.",
      };
    }
    attendancePct = attendance.pct;
  }

  let waiver = null;
  if (!skipMemberRequirements && waiverRes.res.ok) {
    const val = (waiverRes.data.data as { value?: unknown } | undefined)?.value;
    const map = buildUktWaiverMap(
      [{ key: uktRegistrationWaiverKey(eventId, memberId), value: val }],
      eventId,
    );
    waiver = map.get(memberId) ?? null;
  }

  const blockers = getUktRegistrationBlockersWithWaiver(
    {
      outstandingDues,
      birthCertificateUrl: req.requireDocuments
        ? ((member.birthCertificateUrl as string | null) ?? null)
        : "skip",
      bpjsCardUrl: req.requireDocuments
        ? ((member.bpjsCardUrl as string | null) ?? null)
        : "skip",
      pendingVerifications: 0,
      attendancePct,
    },
    {
      registrationOpen,
      registrationNotYetOpen,
      requireNoOutstandingDues: req.requireNoOutstandingDues,
      requireDocuments: req.requireDocuments,
      requireMinAttendance: req.requireMinAttendance,
      minAttendancePct: req.minAttendancePct,
    },
    waiver,
  );

  if (blockers.length > 0) {
    return {
      ok: false,
      error: formatUktRegistrationBlockers(blockers, req.minAttendancePct),
    };
  }

  if (!registrationOpen) {
    if (registrationNotYetOpen) {
      const openAt = getUktRegistrationOpenAt(schedule);
      return {
        ok: false,
        error: `Pendaftaran belum dibuka${openAt ? ` (mulai ${openAt.toLocaleString("id-ID")})` : ""}`,
      };
    }
    const deadline = getUktRegistrationDeadline(schedule);
    return {
      ok: false,
      error: `Batas pendaftaran sudah lewat (${deadline.toLocaleString("id-ID")})`,
    };
  }

  return { ok: true };
}
