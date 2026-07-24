import { prisma } from "@/lib/prisma";
import { UKT_MIN_ATTENDANCE_PCT } from "@/lib/ukt";

export const UKT_REGISTRATION_POLICY_KEY = "ukt.registration.policy";

/**
 * Kebijakan syarat pendaftaran UKT tingkat cabang (bisa diubah di Pengaturan → UKT).
 * Periode buka/tutup selalu berlaku terlepas dari opsi di bawah.
 */
export type UktRegistrationPolicy = {
  /** Wajib iuran tidak menunggak */
  requireNoOutstandingDues: boolean;
  /** Wajib Akte + BPJS */
  requireDocuments: boolean;
  /** Wajib kehadiran semester ≥ minAttendancePct */
  requireMinAttendance: boolean;
  /** Terapkan 3 syarat di atas ke admin ranting */
  enforceForRanting: boolean;
  /** Terapkan 3 syarat di atas ke admin cabang (waiver tetap tersedia) */
  enforceForCabang: boolean;
  minAttendancePct: number;
  updatedAt?: string;
};

export const DEFAULT_UKT_REGISTRATION_POLICY: UktRegistrationPolicy = {
  requireNoOutstandingDues: true,
  requireDocuments: true,
  requireMinAttendance: true,
  // Default selaras kebutuhan operasional: ranting boleh daftar dulu
  enforceForRanting: false,
  enforceForCabang: true,
  minAttendancePct: UKT_MIN_ATTENDANCE_PCT,
};

function asBool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

export function parseUktRegistrationPolicy(value: unknown): UktRegistrationPolicy {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_UKT_REGISTRATION_POLICY };
  }
  const v = value as Record<string, unknown>;
  const pct = Number(v.minAttendancePct);
  return {
    requireNoOutstandingDues: asBool(
      v.requireNoOutstandingDues,
      DEFAULT_UKT_REGISTRATION_POLICY.requireNoOutstandingDues,
    ),
    requireDocuments: asBool(
      v.requireDocuments,
      DEFAULT_UKT_REGISTRATION_POLICY.requireDocuments,
    ),
    requireMinAttendance: asBool(
      v.requireMinAttendance,
      DEFAULT_UKT_REGISTRATION_POLICY.requireMinAttendance,
    ),
    enforceForRanting: asBool(
      v.enforceForRanting,
      DEFAULT_UKT_REGISTRATION_POLICY.enforceForRanting,
    ),
    enforceForCabang: asBool(
      v.enforceForCabang,
      DEFAULT_UKT_REGISTRATION_POLICY.enforceForCabang,
    ),
    minAttendancePct:
      Number.isFinite(pct) && pct >= 0 && pct <= 100
        ? Math.round(pct)
        : DEFAULT_UKT_REGISTRATION_POLICY.minAttendancePct,
    updatedAt: typeof v.updatedAt === "string" ? v.updatedAt : undefined,
  };
}

export async function getUktRegistrationPolicy(): Promise<UktRegistrationPolicy> {
  const row = await prisma.appSetting.findUnique({
    where: { key: UKT_REGISTRATION_POLICY_KEY },
  });
  return parseUktRegistrationPolicy(row?.value);
}

export async function setUktRegistrationPolicy(
  policy: Omit<UktRegistrationPolicy, "updatedAt">,
): Promise<UktRegistrationPolicy> {
  const value: UktRegistrationPolicy = {
    ...policy,
    updatedAt: new Date().toISOString(),
  };
  await prisma.appSetting.upsert({
    where: { key: UKT_REGISTRATION_POLICY_KEY },
    create: { key: UKT_REGISTRATION_POLICY_KEY, value },
    update: { value },
  });
  return value;
}

/** Syarat anggota yang aktif untuk peran tertentu (periode tidak termasuk). */
export function resolveUktMemberRequirementFlags(
  policy: UktRegistrationPolicy,
  primaryRole: string,
): {
  requireNoOutstandingDues: boolean;
  requireDocuments: boolean;
  requireMinAttendance: boolean;
  minAttendancePct: number;
} {
  // Daftar mandiri anggota: selalu enforce flag syarat yang aktif di kebijakan
  if (primaryRole === "MEMBER") {
    return {
      requireNoOutstandingDues: policy.requireNoOutstandingDues,
      requireDocuments: policy.requireDocuments,
      requireMinAttendance: policy.requireMinAttendance,
      minAttendancePct: policy.minAttendancePct,
    };
  }

  const enforce =
    primaryRole === "ADMIN_DOJO"
      ? policy.enforceForRanting
      : policy.enforceForCabang;

  if (!enforce) {
    return {
      requireNoOutstandingDues: false,
      requireDocuments: false,
      requireMinAttendance: false,
      minAttendancePct: policy.minAttendancePct,
    };
  }

  return {
    requireNoOutstandingDues: policy.requireNoOutstandingDues,
    requireDocuments: policy.requireDocuments,
    requireMinAttendance: policy.requireMinAttendance,
    minAttendancePct: policy.minAttendancePct,
  };
}
