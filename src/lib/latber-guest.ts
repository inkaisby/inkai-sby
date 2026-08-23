import { prisma } from "@/lib/prisma";
import { inkaiFetch, inkaiErrorMessage } from "@/lib/inkai-api/server";
import { DEFAULT_MEMBER_RANK, formatRankLabel } from "@/lib/belt";
import {
  findMemberDuplicates,
  formatDuplicateError,
  hardDuplicates,
} from "@/lib/member-duplicate";
import { forceRegisterLatberInDb } from "@/lib/latber-register";
import { resolveLatberPeriodFees } from "@/lib/latber";
import { validateLatberPublicEligibility } from "@/lib/latber-public";
import { writeAuditLog } from "@/lib/audit";

export type LatberGuestMeta = {
  source: "latber-guest";
  createdAt: string;
  eventId: string;
  phoneNumber?: string | null;
};

export function latberGuestKey(memberId: string): string {
  return `latber-guest:${memberId}`;
}

export function parseLatberGuestMeta(value: unknown): LatberGuestMeta | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (raw.source !== "latber-guest") return null;
  return {
    source: "latber-guest",
    createdAt:
      typeof raw.createdAt === "string"
        ? raw.createdAt
        : new Date().toISOString(),
    eventId: typeof raw.eventId === "string" ? raw.eventId : "",
    phoneNumber:
      typeof raw.phoneNumber === "string" ? raw.phoneNumber : null,
  };
}

export async function loadLatberGuestMeta(
  memberId: string,
): Promise<LatberGuestMeta | null> {
  const row = await prisma.appSetting.findUnique({
    where: { key: latberGuestKey(memberId) },
    select: { value: true },
  });
  return parseLatberGuestMeta(row?.value);
}

export async function upsertLatberGuestMeta(
  memberId: string,
  meta: LatberGuestMeta,
): Promise<void> {
  const key = latberGuestKey(memberId);
  await prisma.appSetting.upsert({
    where: { key },
    create: { key, value: meta },
    update: { value: meta },
  });
}

export async function deleteLatberGuestMeta(memberId: string): Promise<void> {
  try {
    await prisma.appSetting.delete({
      where: { key: latberGuestKey(memberId) },
    });
  } catch {
    /* ignore missing */
  }
}

export async function loadLatberGuestFlags(
  memberIds: string[],
): Promise<Map<string, LatberGuestMeta>> {
  const map = new Map<string, LatberGuestMeta>();
  if (memberIds.length === 0) return map;
  const rows = await prisma.appSetting.findMany({
    where: { key: { in: memberIds.map(latberGuestKey) } },
    select: { key: true, value: true },
  });
  const prefix = "latber-guest:";
  for (const row of rows) {
    const parsed = parseLatberGuestMeta(row.value);
    if (!parsed) continue;
    const memberId = row.key.startsWith(prefix)
      ? row.key.slice(prefix.length)
      : "";
    if (memberId) map.set(memberId, parsed);
  }
  return map;
}

/** Identitas cukup untuk promote ke Active (NIK opsional). */
export function isMembershipReady(fields: {
  fullName?: string | null;
  dojoId?: string | null;
  gender?: string | null;
  birthPlace?: string | null;
  birthDate?: string | Date | null;
  address?: string | null;
  phoneNumber?: string | null;
}): boolean {
  if (!fields.fullName?.trim() || fields.fullName.trim().length < 2) return false;
  if (!fields.dojoId?.trim()) return false;
  const gender = String(fields.gender ?? "").toUpperCase();
  if (gender !== "L" && gender !== "P") return false;
  if (!fields.birthPlace?.trim()) return false;
  const birth =
    fields.birthDate instanceof Date
      ? fields.birthDate.toISOString().slice(0, 10)
      : String(fields.birthDate ?? "").trim();
  if (!birth) return false;
  if (!fields.address?.trim() || fields.address.trim().length < 5) return false;
  const phone = String(fields.phoneNumber ?? "").trim();
  if (!phone || phone.length < 10) return false;
  return true;
}

export type CreateLatberGuestInput = {
  eventId: string;
  fullName: string;
  dojoId: string;
  currentRank?: string;
  phoneNumber?: string;
  token: string;
  registeredByUserId?: string | null;
  audit?: {
    userId?: string;
    email?: string;
    ip?: string | null;
    userAgent?: string | null;
  };
};

export type CreateLatberGuestResult =
  | {
      ok: true;
      memberId: string;
      registrationId: string;
      billingId: string | null;
      memberName: string;
      softDuplicates?: Array<{ id: string; fullName: string }>;
    }
  | { ok: false; error: string; code?: string; status?: number };

/**
 * Buat stub Member PENDING + daftar Latber Belum Bayar + flag tamu.
 * Tidak membuat akun login.
 */
export async function createLatberGuestAndRegister(
  input: CreateLatberGuestInput,
): Promise<CreateLatberGuestResult> {
  const eligibility = await validateLatberPublicEligibility(input.eventId);
  if (!eligibility.ok) {
    return { ok: false, error: eligibility.error, status: 403 };
  }

  const fullName = input.fullName.trim().toUpperCase();
  if (fullName.length < 2) {
    return { ok: false, error: "Nama lengkap wajib diisi", status: 400 };
  }
  if (!input.dojoId) {
    return { ok: false, error: "Ranting wajib dipilih", status: 400 };
  }

  const dojo = await prisma.dojo.findFirst({
    where: { id: input.dojoId, isDeleted: false },
    select: { id: true, name: true },
  });
  if (!dojo) {
    return { ok: false, error: "Ranting tidak ditemukan", status: 400 };
  }

  const phoneNumber = input.phoneNumber?.trim() || undefined;
  if (phoneNumber && phoneNumber.length < 10) {
    return { ok: false, error: "Nomor telepon tidak valid", status: 400 };
  }

  const currentRank =
    formatRankLabel(input.currentRank?.trim() || "") ||
    input.currentRank?.trim() ||
    DEFAULT_MEMBER_RANK;

  const duplicates = await findMemberDuplicates({ fullName });
  const hard = hardDuplicates(duplicates);
  if (hard.length > 0) {
    return {
      ok: false,
      error: formatDuplicateError(hard, "admin"),
      code: "DUPLICATE_MEMBER",
      status: 409,
    };
  }

  const softDuplicates = duplicates
    .filter((d) => d.severity !== "hard")
    .slice(0, 5)
    .map((d) => ({ id: d.id, fullName: d.fullName }));

  const payload: Record<string, unknown> = {
    fullName,
    name: fullName,
    dojoId: input.dojoId,
    currentRank,
    status: "PENDING",
  };
  if (phoneNumber) payload.phoneNumber = phoneNumber;

  const { res, data } = await inkaiFetch(
    "/v1/members",
    { method: "POST", body: JSON.stringify(payload) },
    input.token,
  );
  if (!res.ok) {
    return {
      ok: false,
      error: inkaiErrorMessage(data, "Gagal membuat peserta Latber"),
      status: res.status >= 400 ? res.status : 502,
    };
  }

  const created = data.data as Record<string, unknown> | undefined;
  let memberId =
    typeof created?.id === "string"
      ? created.id
      : typeof (created as { member?: { id?: string } } | undefined)?.member
            ?.id === "string"
        ? (created as { member: { id: string } }).member.id
        : null;

  if (!memberId) {
    const local = await prisma.member.findFirst({
      where: {
        fullName: { equals: fullName, mode: "insensitive" },
        dojoId: input.dojoId,
        isDeleted: false,
        status: { equals: "PENDING", mode: "insensitive" },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    memberId = local?.id ?? null;
  }

  if (!memberId) {
    return {
      ok: false,
      error: "Peserta dibuat tetapi ID belum tersedia. Coba lagi.",
      status: 502,
    };
  }

  // Pastikan Prisma lokal punya status PENDING + sabuk.
  await prisma.member
    .update({
      where: { id: memberId },
      data: {
        status: "PENDING",
        currentRank,
        fullName,
        dojoId: input.dojoId,
      },
    })
    .catch(async () => {
      /* Inkai mungkin belum sync — coba create lokal minimal */
      try {
        await prisma.member.create({
          data: {
            id: memberId!,
            fullName,
            dojoId: input.dojoId,
            currentRank,
            status: "PENDING",
          },
        });
      } catch {
        /* ignore */
      }
    });

  await upsertLatberGuestMeta(memberId, {
    source: "latber-guest",
    createdAt: new Date().toISOString(),
    eventId: input.eventId,
    phoneNumber: phoneNumber ?? null,
  });

  const fees = resolveLatberPeriodFees(eligibility.meta);
  const dbReg = await forceRegisterLatberInDb({
    eventId: input.eventId,
    memberId,
    registeredByUserId: input.registeredByUserId ?? null,
    periodTitle: eligibility.title,
    amount: fees.feeAmount,
    baseFeeAmount: fees.feeAmount,
    uniqueTail: null,
    status: "APPROVED",
    approvePendingSelfReg: true,
  });

  if (!dbReg.ok) {
    return { ok: false, error: dbReg.error, status: 400 };
  }

  writeAuditLog({
    userId: input.audit?.userId,
    email: input.audit?.email,
    action: "LATBER_GUEST_REGISTER",
    details: `Guest Latber ${dbReg.memberName} (${memberId}) → ${eligibility.title} dojo=${dojo.name}`,
    ip: input.audit?.ip,
    userAgent: input.audit?.userAgent,
  });

  return {
    ok: true,
    memberId,
    registrationId: dbReg.registrationId,
    billingId: dbReg.billingId,
    memberName: dbReg.memberName,
    softDuplicates: softDuplicates.length > 0 ? softDuplicates : undefined,
  };
}

export function getLatberServiceToken(): string {
  return (
    process.env.INKAI_SERVICE_TOKEN?.trim() ||
    process.env.CRON_INKAI_TOKEN?.trim() ||
    ""
  );
}
