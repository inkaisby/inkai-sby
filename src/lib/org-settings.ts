import { prisma } from "@/lib/prisma";
import { SITE_CONTACT } from "@/lib/site";

export const ORG_BRANCH_PROFILE_KEY = "org.branch.profile";
export const ORG_OPERATIONAL_DEFAULTS_KEY = "org.operational.defaults";

export type BranchOrgProfile = {
  address: string;
  phone: string;
  whatsapp: string;
  email: string;
  hours: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
  paymentInstructions: string;
  mapsUrl: string;
  /** Nama pejabat untuk dokumen UKT / nota */
  bidangUjianName: string;
  bendaharaCabangName: string;
  ketuaCabangName: string;
  updatedAt?: string;
};

export type OperationalDefaults = {
  monthlyDuesAmount: number;
  paymentInstructions: string;
  forcePasswordHint: boolean;
  updatedAt?: string;
};

export const DEFAULT_BRANCH_PROFILE: BranchOrgProfile = {
  address: SITE_CONTACT.address,
  phone: SITE_CONTACT.phone,
  whatsapp: SITE_CONTACT.whatsapp,
  email: SITE_CONTACT.email,
  hours: SITE_CONTACT.hours,
  bankName: "",
  bankAccountNumber: "",
  bankAccountName: "",
  paymentInstructions: "",
  mapsUrl: SITE_CONTACT.mapsUrl,
  bidangUjianName: "SETIA BASUKI",
  bendaharaCabangName: "Habibur Rahman",
  ketuaCabangName: "",
};

export const DEFAULT_OPERATIONAL: OperationalDefaults = {
  monthlyDuesAmount: 50_000,
  paymentInstructions: "",
  forcePasswordHint: true,
};

function asProfile(value: unknown): BranchOrgProfile {
  if (!value || typeof value !== "object") return { ...DEFAULT_BRANCH_PROFILE };
  const v = value as Record<string, unknown>;
  return {
    address: String(v.address ?? DEFAULT_BRANCH_PROFILE.address),
    phone: String(v.phone ?? DEFAULT_BRANCH_PROFILE.phone),
    whatsapp: String(v.whatsapp ?? DEFAULT_BRANCH_PROFILE.whatsapp),
    email: String(v.email ?? DEFAULT_BRANCH_PROFILE.email),
    hours: String(v.hours ?? DEFAULT_BRANCH_PROFILE.hours),
    bankName: String(v.bankName ?? ""),
    bankAccountNumber: String(v.bankAccountNumber ?? ""),
    bankAccountName: String(v.bankAccountName ?? ""),
    paymentInstructions: String(v.paymentInstructions ?? ""),
    mapsUrl: String(v.mapsUrl ?? DEFAULT_BRANCH_PROFILE.mapsUrl),
    bidangUjianName: String(
      v.bidangUjianName ?? DEFAULT_BRANCH_PROFILE.bidangUjianName,
    ),
    bendaharaCabangName: String(
      v.bendaharaCabangName ?? DEFAULT_BRANCH_PROFILE.bendaharaCabangName,
    ),
    ketuaCabangName: String(v.ketuaCabangName ?? ""),
    updatedAt: typeof v.updatedAt === "string" ? v.updatedAt : undefined,
  };
}

function asDefaults(value: unknown): OperationalDefaults {
  if (!value || typeof value !== "object") return { ...DEFAULT_OPERATIONAL };
  const v = value as Record<string, unknown>;
  const amount = Number(v.monthlyDuesAmount);
  return {
    monthlyDuesAmount:
      Number.isFinite(amount) && amount >= 0
        ? amount
        : DEFAULT_OPERATIONAL.monthlyDuesAmount,
    paymentInstructions: String(
      v.paymentInstructions ?? DEFAULT_OPERATIONAL.paymentInstructions,
    ),
    forcePasswordHint: v.forcePasswordHint !== false,
    updatedAt: typeof v.updatedAt === "string" ? v.updatedAt : undefined,
  };
}

export async function getBranchOrgProfile(): Promise<BranchOrgProfile> {
  const row = await prisma.appSetting.findUnique({
    where: { key: ORG_BRANCH_PROFILE_KEY },
  });
  return asProfile(row?.value);
}

export async function setBranchOrgProfile(profile: BranchOrgProfile) {
  const value = { ...profile, updatedAt: new Date().toISOString() };
  await prisma.appSetting.upsert({
    where: { key: ORG_BRANCH_PROFILE_KEY },
    create: { key: ORG_BRANCH_PROFILE_KEY, value },
    update: { value },
  });
  return value;
}

export async function getOperationalDefaults(): Promise<OperationalDefaults> {
  const row = await prisma.appSetting.findUnique({
    where: { key: ORG_OPERATIONAL_DEFAULTS_KEY },
  });
  return asDefaults(row?.value);
}

export async function setOperationalDefaults(defaults: OperationalDefaults) {
  const value = { ...defaults, updatedAt: new Date().toISOString() };
  await prisma.appSetting.upsert({
    where: { key: ORG_OPERATIONAL_DEFAULTS_KEY },
    create: { key: ORG_OPERATIONAL_DEFAULTS_KEY, value },
    update: { value },
  });
  return value;
}

export type SetupChecklistItem = {
  id: string;
  label: string;
  done: boolean;
  href?: string;
};

export async function buildCabangSetupChecklist(opts: {
  branchId: string | null;
  dojoIds: string[];
  adminCount: number;
  geofenceReady: number;
  rantingCount: number;
}): Promise<{ items: SetupChecklistItem[]; done: number; total: number }> {
  const [profile, defaults] = await Promise.all([
    getBranchOrgProfile(),
    getOperationalDefaults(),
  ]);

  const hasBank = Boolean(
    profile.bankName.trim() &&
      profile.bankAccountNumber.trim() &&
      profile.bankAccountName.trim(),
  );
  const hasContact = Boolean(
    profile.phone.trim() && profile.whatsapp.trim() && profile.email.trim(),
  );
  const hasPayment =
    Boolean(profile.paymentInstructions.trim()) ||
    Boolean(defaults.paymentInstructions.trim());

  const items: SetupChecklistItem[] = [
    {
      id: "admin",
      label: "Minimal 1 akun admin cabang aktif",
      done: opts.adminCount > 0,
      href: "/admin/pengaturan/cabang",
    },
    {
      id: "contact",
      label: "Kontak sekretariat (telepon, WA, email)",
      done: hasContact,
      href: "/admin/pengaturan/kebijakan",
    },
    {
      id: "bank",
      label: "Rekening resmi cabang",
      done: hasBank,
      href: "/admin/pengaturan/kebijakan",
    },
    {
      id: "payment",
      label: "Instruksi pembayaran iuran",
      done: hasPayment,
      href: "/admin/pengaturan/kebijakan",
    },
    {
      id: "pejabat",
      label: "Pejabat dokumen (Bidang Ujian & Bendahara)",
      done: Boolean(
        profile.bidangUjianName.trim() && profile.bendaharaCabangName.trim(),
      ),
      href: "/admin/pengaturan/kebijakan",
    },
    {
      id: "ranting",
      label: "Minimal 1 ranting terdaftar",
      done: opts.rantingCount > 0,
      href: "/admin/pengaturan/ranting",
    },
    {
      id: "geofence",
      label: "Geofence absensi siap (≥1 ranting)",
      done: opts.geofenceReady > 0,
      href: "/admin/pengaturan/geofencing",
    },
  ];

  const done = items.filter((i) => i.done).length;
  return { items, done, total: items.length };
}
