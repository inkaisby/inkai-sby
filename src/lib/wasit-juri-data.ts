import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import type { AdminDojoGrants, CrudPermission } from "@/lib/admin-dojo-grants";
import { getModuleCrudPermission } from "@/lib/admin-dojo-grants";
import { writeAuditLog, writeLocalAuditLog } from "@/lib/audit";
import { resolveMemberPhotoUrl } from "@/lib/member-photo";
import { prisma, withPrismaFallback } from "@/lib/prisma";
import { memberPhotoSelect } from "@/lib/prisma-columns";
import { buildMemberFilter, getPrimaryAdminRole, type SessionUser } from "@/lib/rbac";
import { forbidUnlessAdminPath } from "@/lib/security/admin-path-guard";
import { getClientIp } from "@/lib/security/request";

export const WASIT_JURI_ADMIN_PATH = "/admin/sertifikasi-wasit-juri";

export type WasitJuriLevelScope =
  | "Cabang"
  | "Pengprov Jatim"
  | "PB INKAI / FORKI";

export type WasitJuriSubmissionType = "BARU" | "KENAIKAN" | "REFRESHING";
export type WasitJuriLicenseGrade = "JURI_B" | "JURI_A" | "WASIT_B" | "WASIT_A";
export type WasitJuriDiscipline = "KATA_KUMITE" | "KUMITE" | "KATA";
export type WasitJuriPaymentState =
  | "BELUM_BAYAR"
  | "MENUNGGU_VERIFIKASI"
  | "LUNAS";
export type WasitJuriPaymentMethod = "TRANSFER" | "TUNAI";
export type WasitJuriRegistrationState =
  | "MENUNGGU_BERKAS"
  | "MENUNGGU_BAYAR"
  | "SIAP_UJIAN"
  | "LULUS"
  | "MENGULANG";

export type DanRankLabel =
  | "DAN I"
  | "DAN II"
  | "DAN III"
  | "DAN IV"
  | "DAN V"
  | "DAN VI"
  | "DAN VII"
  | "Coklat (Kyu 1)";

export interface WasitJuriMemberDocsDto {
  photoUrl: string | null;
  birthCertificateUrl: string | null;
  bpjsCardUrl: string | null;
  bpjsCardNumber: string | null;
}

export interface WasitJuriPeriodDto {
  id: string;
  title: string;
  levelScope: WasitJuriLevelScope;
  theoryDate: string;
  practicalDate: string;
  closeDate: string;
  location: string;
  quota: number;
  feeNew: number;
  feeUpgrade: number;
  feeRefreshing: number;
  isArchived: boolean;
  archivedAt: string | null;
}

export interface WasitJuriRegistrantDto {
  id: string;
  memberId: string;
  periodId: string;
  dojoId: string;
  name: string;
  nia: string;
  mshNumber: string;
  danRank: DanRankLabel;
  dojoName: string;
  age: number | null;
  submissionType: WasitJuriSubmissionType;
  currentLicense: string | null;
  targetGrade: WasitJuriLicenseGrade;
  discipline: WasitJuriDiscipline;
  memberDocs: WasitJuriMemberDocsDto;
  danCertificateUrl: string | null;
  licenseCertUrl: string | null;
  feeAmount: number;
  paymentState: WasitJuriPaymentState;
  paymentMethod: WasitJuriPaymentMethod;
  proofUrl: string | null;
  status: WasitJuriRegistrationState;
  scores: {
    teoriKata: number | null;
    teoriKumite: number | null;
    praktik: number | null;
  };
  grantedLicense: string | null;
  licenseValidUntil: string | null;
  notes: string | null;
  registeredAt: string;
}

const ROMAN_DAN: Record<number, DanRankLabel> = {
  1: "DAN I",
  2: "DAN II",
  3: "DAN III",
  4: "DAN IV",
  5: "DAN V",
  6: "DAN VI",
  7: "DAN VII",
};

export function mapMemberRankToDan(
  rankRaw: string | null | undefined,
): DanRankLabel {
  const r = (rankRaw || "").trim();
  const danNum = r.match(/\bdan\s*(\d+)\b/i);
  if (danNum) {
    const n = Number(danNum[1]);
    return ROMAN_DAN[n] ?? "DAN I";
  }
  if (/\bdan\s*vii\b/i.test(r)) return "DAN VII";
  if (/\bdan\s*vi\b/i.test(r)) return "DAN VI";
  if (/\bdan\s*v\b/i.test(r)) return "DAN V";
  if (/\bdan\s*iv\b/i.test(r)) return "DAN IV";
  if (/\bdan\s*iii\b/i.test(r)) return "DAN III";
  if (/\bdan\s*ii\b/i.test(r)) return "DAN II";
  if (/\bdan\s*i\b/i.test(r) || /hitam/i.test(r)) return "DAN I";
  if (/coklat/i.test(r)) return "Coklat (Kyu 1)";
  return "DAN I";
}

export function computeAgeFromDate(birthDate: Date | null): number | null {
  if (!birthDate || Number.isNaN(birthDate.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const m = now.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) {
    age -= 1;
  }
  return age >= 0 && age <= 110 ? age : null;
}

export function defaultLicenseExpiryYmd(practicalDateYmd: string, years = 3): string {
  const m = practicalDateYmd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) {
    const fallback = new Date();
    fallback.setFullYear(fallback.getFullYear() + years);
    return fallback.toISOString().slice(0, 10);
  }
  const targetYear = Number(m[1]) + years;
  const mm = m[2];
  const dd = mm === "02" && m[3] === "29" ? "28" : m[3];
  return `${targetYear}-${mm}-${dd}`;
}

function toIsoDate(d: Date | null | undefined): string {
  if (!d || Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function normalizeLevelScope(raw: string): WasitJuriLevelScope {
  if (raw === "Pengprov Jatim" || raw === "PB INKAI / FORKI") return raw;
  return "Cabang";
}

function normalizeSubmissionType(raw: string): WasitJuriSubmissionType {
  if (raw === "KENAIKAN" || raw === "REFRESHING") return raw;
  return "BARU";
}

function normalizeLicenseGrade(raw: string): WasitJuriLicenseGrade {
  if (raw === "JURI_A" || raw === "WASIT_B" || raw === "WASIT_A") return raw;
  return "JURI_B";
}

function normalizeDiscipline(raw: string): WasitJuriDiscipline {
  if (raw === "KUMITE" || raw === "KATA") return raw;
  return "KATA_KUMITE";
}

function normalizePaymentState(raw: string): WasitJuriPaymentState {
  if (raw === "MENUNGGU_VERIFIKASI" || raw === "LUNAS") return raw;
  return "BELUM_BAYAR";
}

function normalizePaymentMethod(raw: string | null | undefined): WasitJuriPaymentMethod {
  return raw === "TUNAI" ? "TUNAI" : "TRANSFER";
}

function normalizeRegistrationStatus(
  raw: string,
  docsComplete: boolean,
): WasitJuriRegistrationState {
  if (raw === "SIAP_UJIAN" || raw === "LULUS" || raw === "MENGULANG") {
    return raw;
  }
  return docsComplete ? "MENUNGGU_BAYAR" : "MENUNGGU_BERKAS";
}

export function canUserManageWasitJuriPeriod(user: SessionUser): boolean {
  const role = getPrimaryAdminRole(user.roles ?? []);
  return role !== "ADMIN_DOJO";
}

export function resolveWasitJuriCrudPermission(
  user: SessionUser,
  grants?: AdminDojoGrants | null,
): CrudPermission {
  const role = getPrimaryAdminRole(user.roles ?? []);
  if (role === "ADMINISTRATOR" || role === "ADMIN_PUSAT" || role === "ADMIN_PROVINCE") {
    return { read: true, create: true, update: true, delete: true };
  }
  return getModuleCrudPermission(grants, WASIT_JURI_ADMIN_PATH);
}

/**
 * Validasi akses path + hak CRUD granular untuk endpoint Wasit Juri.
 * Mengembalikan NextResponse 403 bila ditolak, atau null bila diizinkan.
 */
export function forbidWasitJuriAction(
  user: SessionUser,
  grants: AdminDojoGrants | null | undefined,
  action: keyof CrudPermission,
): NextResponse | null {
  const pathBlock = forbidUnlessAdminPath(
    user.roles ?? [],
    WASIT_JURI_ADMIN_PATH,
    grants,
  );
  if (pathBlock) return pathBlock;

  const perm = resolveWasitJuriCrudPermission(user, grants);
  if (!perm[action]) {
    const labelMap: Record<keyof CrudPermission, string> = {
      read: "melihat data",
      create: "menambah pendaftaran",
      update: "memperbarui data",
      delete: "menghapus pendaftaran",
    };
    return NextResponse.json(
      {
        error: `Akun pengurus Anda berstatus akses terbatas dan tidak diizinkan ${labelMap[action]} Sertifikasi Wasit Juri.`,
      },
      { status: 403 },
    );
  }
  return null;
}

export function writeWasitJuriAudit(opts: {
  user: SessionUser;
  token?: string | null;
  request: Request;
  action: string;
  details: string;
}) {
  const ip = getClientIp(opts.request);
  const userAgent = opts.request.headers.get("user-agent");
  writeAuditLog({
    token: opts.token,
    userId: opts.user.id,
    email: opts.user.email,
    action: opts.action,
    details: opts.details,
    ip,
    userAgent,
  });
  writeLocalAuditLog({
    userId: opts.user.id,
    email: opts.user.email,
    action: opts.action,
    details: opts.details,
    ip,
    userAgent,
  });
}

export function serializeWasitJuriPeriod(p: {
  id: string;
  title: string;
  levelScope: string;
  theoryDate: Date;
  practicalDate: Date;
  closeDate: Date;
  location: string;
  quota: number;
  feeNew: number;
  feeUpgrade: number;
  feeRefreshing: number;
  isArchived: boolean;
  archivedAt: Date | null;
}): WasitJuriPeriodDto {
  return {
    id: p.id,
    title: p.title,
    levelScope: normalizeLevelScope(p.levelScope),
    theoryDate: toIsoDate(p.theoryDate),
    practicalDate: toIsoDate(p.practicalDate),
    closeDate: toIsoDate(p.closeDate),
    location: p.location,
    quota: p.quota,
    feeNew: p.feeNew,
    feeUpgrade: p.feeUpgrade,
    feeRefreshing: p.feeRefreshing,
    isArchived: p.isArchived,
    archivedAt: p.archivedAt ? toIsoDate(p.archivedAt) : null,
  };
}

type RawRegistrationWithRelations = {
  id: string;
  periodId: string;
  memberId: string;
  dojoId: string;
  danRankSnapshot: string;
  mshNumberSnapshot: string | null;
  submissionType: string;
  currentLicense: string | null;
  targetGrade: string;
  discipline: string;
  feeAmount: number;
  paymentState: string;
  paymentMethod: string | null;
  proofUrl: string | null;
  danCertificateUrl: string | null;
  licenseCertUrl: string | null;
  status: string;
  scoreTeoriKata: number | null;
  scoreTeoriKumite: number | null;
  scorePraktik: number | null;
  grantedLicense: string | null;
  licenseValidUntil: Date | null;
  notes: string | null;
  createdAt: Date;
  dojo: { id: string; name: string };
  member: {
    id: string;
    fullName: string;
    nia: string | null;
    mshNumber: string | null;
    currentRank: string;
    birthDate: Date | null;
    birthCertificateUrl: string | null;
    bpjsCardUrl: string | null;
    bpjsCardNumber: string | null;
    photoUrl?: string | null;
    user: { photoUrl: string | null } | null;
  };
};

export function serializeWasitJuriRegistration(
  r: RawRegistrationWithRelations,
): WasitJuriRegistrantDto {
  const photoUrl = resolveMemberPhotoUrl(r.member.photoUrl, r.member.user?.photoUrl);
  const birthCertificateUrl = r.member.birthCertificateUrl?.trim() || null;
  const bpjsCardUrl = r.member.bpjsCardUrl?.trim() || null;
  const bpjsCardNumber = r.member.bpjsCardNumber?.trim() || null;
  const danCertificateUrl = r.danCertificateUrl?.trim() || null;
  const licenseCertUrl = r.licenseCertUrl?.trim() || null;
  const subType = normalizeSubmissionType(r.submissionType);
  const needsPriorLicense = subType === "KENAIKAN" || subType === "REFRESHING";
  const docsComplete = Boolean(
    photoUrl &&
      birthCertificateUrl &&
      bpjsCardUrl &&
      (!needsPriorLicense || licenseCertUrl || r.currentLicense?.trim()),
  );

  const memberDan = r.member.currentRank
    ? mapMemberRankToDan(r.member.currentRank)
    : mapMemberRankToDan(r.danRankSnapshot);

  return {
    id: r.id,
    memberId: r.memberId,
    periodId: r.periodId,
    dojoId: r.dojoId,
    name: r.member.fullName.toUpperCase(),
    nia: r.member.nia?.trim() || "—",
    mshNumber:
      r.member.mshNumber?.trim() || r.mshNumberSnapshot?.trim() || "—",
    danRank: memberDan,
    dojoName: r.dojo.name.trim(),
    age: computeAgeFromDate(r.member.birthDate),
    submissionType: subType,
    currentLicense: r.currentLicense?.trim() || null,
    targetGrade: normalizeLicenseGrade(r.targetGrade),
    discipline: normalizeDiscipline(r.discipline),
    memberDocs: {
      photoUrl,
      birthCertificateUrl,
      bpjsCardUrl,
      bpjsCardNumber,
    },
    danCertificateUrl,
    licenseCertUrl,
    feeAmount: r.feeAmount,
    paymentState: normalizePaymentState(r.paymentState),
    paymentMethod: normalizePaymentMethod(r.paymentMethod),
    proofUrl: r.proofUrl?.trim() || null,
    status: normalizeRegistrationStatus(r.status, docsComplete),
    scores: {
      teoriKata: r.scoreTeoriKata,
      teoriKumite: r.scoreTeoriKumite,
      praktik: r.scorePraktik,
    },
    grantedLicense: r.grantedLicense?.trim() || null,
    licenseValidUntil: r.licenseValidUntil ? toIsoDate(r.licenseValidUntil) : null,
    notes: r.notes?.trim() || null,
    registeredAt: toIsoDate(r.createdAt),
  };
}

export async function wasitJuriRegistrationInclude() {
  const photoSelect = await memberPhotoSelect();
  return {
    dojo: { select: { id: true, name: true } },
    member: {
      select: {
        id: true,
        fullName: true,
        nia: true,
        mshNumber: true,
        currentRank: true,
        birthDate: true,
        birthCertificateUrl: true,
        bpjsCardUrl: true,
        bpjsCardNumber: true,
        ...photoSelect,
        user: { select: { photoUrl: true } },
      },
    },
  } satisfies Prisma.WasitJuriRegistrationInclude;
}

export async function fetchWasitJuriData(user: SessionUser): Promise<{
  periods: WasitJuriPeriodDto[];
  registrations: WasitJuriRegistrantDto[];
  degraded: boolean;
}> {
  const include = await wasitJuriRegistrationInclude();

  const [periodsRes, regsRes] = await Promise.all([
    withPrismaFallback(
      "wasit-juri-periods",
      () =>
        prisma.wasitJuriPeriod.findMany({
          orderBy: [{ practicalDate: "desc" }, { createdAt: "desc" }],
        }),
      [],
    ),
    withPrismaFallback(
      "wasit-juri-registrations",
      () =>
        prisma.wasitJuriRegistration.findMany({
          where: {
            member: {
              isDeleted: false,
              ...buildMemberFilter(user),
            },
          },
          include,
          orderBy: [{ createdAt: "desc" }],
        }),
      [],
    ),
  ]);

  return {
    periods: periodsRes.data.map(serializeWasitJuriPeriod),
    registrations: regsRes.data.map((r) =>
      serializeWasitJuriRegistration(
        r as unknown as RawRegistrationWithRelations,
      ),
    ),
    degraded: Boolean(periodsRes.degraded || regsRes.degraded),
  };
}
