import { inkaiFetch } from "@/lib/inkai-api/server";
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
    { res: memberRes, data: memberData },
    billingsScoped,
    waiverRes,
    metaRes,
  ] = await Promise.all([
    inkaiFetch(`/v1/events/${eventId}`, {}, token),
    inkaiFetch(`/v1/members/${memberId}`, {}, token),
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
  if (!memberRes.ok) {
    return { ok: false, error: "Anggota tidak ditemukan" };
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
  const member = memberData.data as Record<string, unknown>;
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
