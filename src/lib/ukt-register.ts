import { inkaiFetch } from "@/lib/inkai-api/server";
import { getBeltGroup } from "@/lib/belt";
import { prisma } from "@/lib/prisma";
import { isMemberDuesExempt } from "@/lib/member-local-fields";
import {
  buildUktSemesterWindow,
  buildUktWaiverMap,
  computeSemesterAttendance,
  DEFAULT_BELT_FEES,
  formatUktRegistrationBlockers,
  getUktRegistrationBlockersWithWaiver,
  getUktRegistrationDeadline,
  getUktRegistrationOpenAt,
  isUktRegistrationNotYetOpen,
  isUktRegistrationOpen,
  parseUktEventTitle,
  parseUktPeriodMetaValue,
  type BeltFeeKey,
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
 * Inkai GET by-id sering 403/404 untuk token ranting (multi-dojo / soft-delete) —
 * fallback Prisma. Pulihkan soft-delete hanya via Prisma (jangan PATCH Inkai
 * dengan token ranting → "Akses wilayah ditolak").
 */
async function resolveMemberForUktRegister(
  _token: string,
  memberId: string,
): Promise<
  | { ok: true; member: Record<string, unknown> }
  | { ok: false; error: string }
> {
  let member: Record<string, unknown> | null = null;

  const { res, data } = await inkaiFetch(`/v1/members/${memberId}`, {}, _token);
  if (res.ok) {
    member = (data.data as Record<string, unknown>) ?? {};
  }

  let local: {
    id: string;
    isDeleted: boolean;
    status: string;
    fullName: string;
    currentRank: string;
    birthCertificateUrl: string | null;
    bpjsCardUrl: string | null;
    allowEventWithoutDues: boolean;
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
        allowEventWithoutDues: true,
      },
    });
  } catch (error) {
    console.error("[ukt-register] prisma member lookup failed", error);
  }

  if (!member && !local) {
    return { ok: false, error: "Anggota tidak ditemukan" };
  }

  if (local) {
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
        local = { ...local, isDeleted: false, status: restoreStatus };
        console.warn(
          "[ukt-register] restored soft-deleted member via Prisma",
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

    if (!member) {
      return {
        ok: true,
        member: {
          id: local.id,
          fullName: local.fullName,
          currentRank: local.currentRank,
          status: local.status,
          birthCertificateUrl: local.birthCertificateUrl,
          bpjsCardUrl: local.bpjsCardUrl,
          allowEventWithoutDues: local.allowEventWithoutDues,
        },
      };
    }

    member = {
      ...member,
      birthCertificateUrl:
        (member.birthCertificateUrl as string | null | undefined) ??
        local.birthCertificateUrl,
      bpjsCardUrl:
        (member.bpjsCardUrl as string | null | undefined) ?? local.bpjsCardUrl,
      allowEventWithoutDues: local.allowEventWithoutDues,
    };
  }

  if (!member) {
    return { ok: false, error: "Anggota tidak ditemukan" };
  }

  return { ok: true, member };
}

export function isInkaiScopeDeniedError(
  message: string,
  status?: number,
): boolean {
  const m = message.toLowerCase();
  if (status === 403) return true;
  return (
    m.includes("wilayah") ||
    m.includes("akses ditolak") ||
    m.includes("forbidden") ||
    m.includes("di luar cakupan") ||
    m.includes("out of scope")
  );
}

/** Daftar UKT langsung di DB bersama bila API Inkai menolak token ranting. */
export async function forceRegisterUktInDb(opts: {
  eventId: string;
  memberId: string;
  registeredByUserId: string;
  kyuLamaSnapshot: string;
  periodTitle: string;
  amount: number;
}): Promise<
  | {
      ok: true;
      registrationId: string;
      billingId: string;
      billingAmount: number;
      billingStatus: string;
      memberName: string;
    }
  | { ok: false; error: string }
> {
  const amount = Math.max(0, Math.round(opts.amount));
  try {
    const existing = await prisma.eventRegistration.findFirst({
      where: { eventId: opts.eventId, memberId: opts.memberId },
      select: { id: true, status: true },
    });
    if (existing && existing.status !== "REJECTED" && existing.status !== "CANCELLED") {
      if (existing.status === "PENDING") {
        return {
          ok: false,
          error:
            "Anggota sudah mengajukan daftar mandiri — gunakan tombol Terima di baris tersebut",
        };
      }
      return {
        ok: false,
        error: "Anggota sudah terdaftar pada periode UKT ini",
      };
    }

    const member = await prisma.member.findFirst({
      where: { id: opts.memberId, isDeleted: false },
      select: { fullName: true, currentRank: true },
    });
    if (!member) {
      return { ok: false, error: "Anggota tidak ditemukan" };
    }

    const event = await prisma.event.findFirst({
      where: { id: opts.eventId, isDeleted: false },
      select: { id: true, title: true, registrationCloseAt: true, endDate: true },
    });
    if (!event) {
      return { ok: false, error: "Periode UKT tidak ditemukan" };
    }

    const registration = existing
      ? await prisma.eventRegistration.update({
          where: { id: existing.id },
          data: {
            status: "APPROVED",
            registeredRank: opts.kyuLamaSnapshot,
            registeredByUserId: opts.registeredByUserId,
          },
        })
      : await prisma.eventRegistration.create({
          data: {
            eventId: opts.eventId,
            memberId: opts.memberId,
            registeredByUserId: opts.registeredByUserId,
            status: "APPROVED",
            registeredRank: opts.kyuLamaSnapshot,
          },
        });

    const dueDate =
      event.registrationCloseAt ?? event.endDate ?? new Date();
    const desc = `UKT — ${opts.periodTitle || event.title || "Pendaftaran"}`;

    const billing = await prisma.billing.create({
      data: {
        memberId: opts.memberId,
        registrationId: registration.id,
        type: "EVENT",
        amount,
        baseFeeAmount: amount,
        description: desc,
        dueDate,
        status: "PENDING",
        isDeleted: false,
      },
    });

    return {
      ok: true,
      registrationId: registration.id,
      billingId: billing.id,
      billingAmount: amount,
      billingStatus: "PENDING",
      memberName: member.fullName,
    };
  } catch (error) {
    console.error("[ukt-register] forceRegisterUktInDb failed", error);
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Gagal mendaftarkan anggota di database",
    };
  }
}

export async function resolveUktRegisterFeeAmount(opts: {
  token: string;
  eventId: string;
  memberRank: string;
}): Promise<number> {
  const group = getBeltGroup(opts.memberRank);
  const key =
    group === "LAINNYA"
      ? null
      : (group as BeltFeeKey);
  const fees = { ...DEFAULT_BELT_FEES };
  try {
    const { res, data } = await inkaiFetch(
      `/v1/settings/${encodeURIComponent(uktPeriodMetaKey(opts.eventId))}`,
      {},
      opts.token,
      { timeoutMs: 5_000, retries: 0 },
    );
    if (res.ok) {
      const meta = parseUktPeriodMetaValue(
        (data.data as { value?: unknown } | undefined)?.value ?? null,
      );
      if (meta.beltFees) {
        for (const k of Object.keys(fees) as BeltFeeKey[]) {
          const n = Number(meta.beltFees[k]);
          if (Number.isFinite(n) && n > 0) fees[k] = Math.round(n);
        }
      }
    }
  } catch {
    /* pakai default */
  }
  if (key && key in fees) return fees[key];
  return fees.PUTIH;
}

export async function validateUktRegistrationEligibility(
  token: string,
  eventId: string,
  memberId: string,
  opts?: {
    primaryRole?: string;
  },
): Promise<
  | { ok: true; blockers: [] }
  | {
      ok: false;
      error: string;
      blockers: import("@/lib/ukt").UktRegistrationBlocker[];
    }
> {
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
    return {
      ok: false,
      error: "Periode UKT tidak ditemukan",
      blockers: ["PERIODE_TUTUP"],
    };
  }
  if (!memberResolved.ok) {
    return { ok: false, error: memberResolved.error, blockers: [] };
  }

  let billingsRes = billingsScoped;
  if (req.requireNoOutstandingDues && !billingsRes.res.ok) {
    billingsRes = await inkaiFetch("/v1/billing?limit=250", {}, token);
  }
  if (req.requireNoOutstandingDues && !billingsRes.res.ok) {
    return {
      ok: false,
      error: "Gagal memverifikasi status iuran. Coba lagi.",
      blockers: [],
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
  if (req.requireNoOutstandingDues && !isMemberDuesExempt(member)) {
    const billings = (billingsRes.data.data as Array<Record<string, unknown>>) ?? [];
    for (const b of billings) {
      if (String(b.memberId) !== memberId) continue;
      const status = String(b.status ?? "");
      const type = String(b.type ?? "").toUpperCase();
      const desc = String(b.description ?? "").toUpperCase();
      // Jangan hitung tagihan UKT/event sebagai tunggakan iuran bulanan
      if (type.includes("UKT") || type === "EVENT" || desc.includes("UKT")) {
        continue;
      }
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
        blockers: [],
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
      blockers,
    };
  }

  if (!registrationOpen) {
    if (registrationNotYetOpen) {
      const openAt = getUktRegistrationOpenAt(schedule);
      return {
        ok: false,
        error: `Pendaftaran belum dibuka${openAt ? ` (mulai ${openAt.toLocaleString("id-ID")})` : ""}`,
        blockers: ["PERIODE_BELUM_BUKA"],
      };
    }
    const deadline = getUktRegistrationDeadline(schedule);
    return {
      ok: false,
      error: `Batas pendaftaran sudah lewat (${deadline.toLocaleString("id-ID")})`,
      blockers: ["PERIODE_TUTUP"],
    };
  }

  return { ok: true, blockers: [] };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

/** Daftar UKT mandiri: PENDING, tanpa billing (anti-bocor nominal). */
export async function forceRegisterUktPendingInDb(opts: {
  eventId: string;
  memberId: string;
  registeredByUserId: string;
  kyuLamaSnapshot: string;
}): Promise<
  | {
      ok: true;
      registrationId: string;
      memberName: string;
      alreadyRegistered: boolean;
      status: string;
    }
  | { ok: false; error: string }
> {
  try {
    const existing = await prisma.eventRegistration.findFirst({
      where: { eventId: opts.eventId, memberId: opts.memberId },
      select: { id: true, status: true },
    });
    if (existing && existing.status !== "REJECTED" && existing.status !== "CANCELLED") {
      return {
        ok: true,
        registrationId: existing.id,
        memberName: "",
        alreadyRegistered: true,
        status: existing.status,
      };
    }

    const member = await prisma.member.findFirst({
      where: { id: opts.memberId, isDeleted: false },
      select: { fullName: true },
    });
    if (!member) {
      return { ok: false, error: "Anggota tidak ditemukan" };
    }

    const event = await prisma.event.findFirst({
      where: { id: opts.eventId, isDeleted: false },
      select: { id: true },
    });
    if (!event) {
      return { ok: false, error: "Periode UKT tidak ditemukan" };
    }

    try {
      const registration = existing
        ? await prisma.eventRegistration.update({
            where: { id: existing.id },
            data: {
              status: "PENDING",
              registeredRank: opts.kyuLamaSnapshot,
              registeredByUserId: opts.registeredByUserId,
            },
          })
        : await prisma.eventRegistration.create({
            data: {
              eventId: opts.eventId,
              memberId: opts.memberId,
              registeredByUserId: opts.registeredByUserId,
              status: "PENDING",
              registeredRank: opts.kyuLamaSnapshot,
            },
          });

      return {
        ok: true,
        registrationId: registration.id,
        memberName: member.fullName,
        alreadyRegistered: false,
        status: "PENDING",
      };
    } catch (error) {
      if (isUniqueViolation(error)) {
        const again = await prisma.eventRegistration.findFirst({
          where: { eventId: opts.eventId, memberId: opts.memberId },
          select: { id: true, status: true },
        });
        if (again) {
          return {
            ok: true,
            registrationId: again.id,
            memberName: member.fullName,
            alreadyRegistered: true,
            status: again.status,
          };
        }
      }
      throw error;
    }
  } catch (error) {
    console.error("[ukt-register] forceRegisterUktPendingInDb failed", error);
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Gagal mendaftarkan ke periode UKT",
    };
  }
}

/** Setelah ranting Terima: pastikan satu billing PENDING lalu siap diajukan. */
export async function ensureUktBillingForAcceptedRegistration(opts: {
  eventId: string;
  memberId: string;
  registrationId: string;
  memberRank: string;
  periodTitle: string;
  token: string;
}): Promise<
  | { ok: true; billingId: string; created: boolean }
  | { ok: false; error: string }
> {
  const existing = await prisma.billing.findFirst({
    where: {
      registrationId: opts.registrationId,
      isDeleted: false,
      status: { notIn: ["CANCELLED", "REJECTED"] },
    },
    select: { id: true, status: true },
    orderBy: { createdAt: "desc" },
  });
  if (existing) {
    return { ok: true, billingId: existing.id, created: false };
  }

  const amount = await resolveUktRegisterFeeAmount({
    token: opts.token,
    eventId: opts.eventId,
    memberRank: opts.memberRank,
  });
  const event = await prisma.event.findFirst({
    where: { id: opts.eventId },
    select: { registrationCloseAt: true, endDate: true, title: true },
  });
  const dueDate =
    event?.registrationCloseAt ?? event?.endDate ?? new Date();

  try {
    const billing = await prisma.billing.create({
      data: {
        memberId: opts.memberId,
        registrationId: opts.registrationId,
        type: "EVENT",
        amount: Math.max(0, Math.round(amount)),
        baseFeeAmount: Math.max(0, Math.round(amount)),
        description: `UKT — ${opts.periodTitle || event?.title || "Pendaftaran"}`,
        dueDate,
        status: "PENDING",
        isDeleted: false,
      },
    });
    return { ok: true, billingId: billing.id, created: true };
  } catch (error) {
    console.error("[ukt-register] ensureUktBilling failed", error);
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Gagal membuat tagihan UKT",
    };
  }
}
