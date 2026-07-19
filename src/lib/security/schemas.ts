import { z } from "zod";

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nama minimal 2 karakter")
    .max(100, "Nama terlalu panjang")
    .regex(/^[\p{L}\p{N}\s.'-]+$/u, "Nama mengandung karakter tidak valid"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Format email tidak valid")
    .max(254),
  password: z.string().min(1, "Password wajib diisi"),
  dojoId: z.string().uuid("Dojo tidak valid"),
  nik: z
    .string()
    .trim()
    .regex(/^\d{16}$/, "NIK harus 16 digit")
    .optional()
    .or(z.literal("")),
  phoneNumber: z
    .string()
    .trim()
    .min(10, "Nomor telepon tidak valid")
    .max(20)
    .optional()
    .or(z.literal("")),
  gender: z.enum(["L", "P"]).optional().or(z.literal("")),
  birthPlace: z.string().trim().max(100).optional().or(z.literal("")),
  birthDate: z.string().optional().or(z.literal("")),
  address: z.string().trim().max(300).optional().or(z.literal("")),
  currentRank: z.string().trim().min(2).max(64).optional(),
  nia: z
    .string()
    .trim()
    .min(2, "NIA minimal 2 karakter")
    .max(32, "NIA maksimal 32 karakter")
    .optional()
    .or(z.literal("")),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Format email tidak valid"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

export const memberActionSchema = z.object({
  action: z.enum([
    "approve",
    "reject",
    "set_nia",
    "set_rank",
    "set_dues",
    "deactivate",
    "activate",
    "delete",
    "restore",
  ]),
  nia: z.string().trim().max(32).optional(),
  /** Sabuk / Kyu resmi anggota (hanya cabang). */
  currentRank: z.string().trim().min(2).max(64).optional(),
  /** Nominal iuran bulanan per anggota (ranting/cabang). */
  monthlyDuesAmount: z.coerce.number().min(0).max(10_000_000).optional(),
  /** Konfirmasi hapus: ketik nama anggota (untuk anggota aktif / ber-NIA). */
  confirmName: z.string().trim().max(120).optional(),
  /** Nonaktif / ditangguhkan */
  statusKind: z.enum(["INACTIVE", "SUSPENDED"]).optional(),
  reasonCode: z
    .enum([
      "BERHENTI_LATIHAN",
      "PINDAH_DOJO",
      "PINDAH_KOTA",
      "TUNGGAKAN",
      "DISIPLIN",
      "LAINNYA",
    ])
    .optional(),
  reasonNote: z.string().trim().max(500).optional(),
});

export const memberBulkActionSchema = z.object({
  action: z.enum(["deactivate", "approve"]),
  memberIds: z.array(z.string().uuid()).min(1).max(50),
  statusKind: z.enum(["INACTIVE", "SUSPENDED"]).default("INACTIVE").optional(),
  reasonCode: z
    .enum([
      "BERHENTI_LATIHAN",
      "PINDAH_DOJO",
      "PINDAH_KOTA",
      "TUNGGAKAN",
      "DISIPLIN",
      "LAINNYA",
    ])
    .optional(),
  reasonNote: z.string().trim().max(500).optional(),
});

export const memberMergeSchema = z.object({
  keepMemberId: z.string().uuid(),
  mergeMemberId: z.string().uuid(),
  /** Jika keduanya punya akun: pilih sumber email yang dipertahankan. */
  preferUserFrom: z.enum(["keep", "merge"]).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const uktPeriodSchema = z.object({
  semester: z.enum(["I", "II"]),
  year: z.coerce.number().int().min(2020).max(2100),
  title: z.string().trim().min(3).max(120).optional(),
  /** Batas pendaftaran (ISO). Default: akhir semester. */
  registrationCloseAt: z.string().datetime().optional(),
});

export const uktPeriodPatchSchema = z.object({
  eventId: z.string().uuid(),
  title: z.string().trim().min(3).max(120).optional(),
  registrationCloseAt: z.string().datetime().optional(),
});

export const uktRegisterSchema = z.object({
  eventId: z.string().uuid(),
  memberId: z.string().uuid(),
});

export const uktWaiverSchema = z.object({
  eventId: z.string().uuid(),
  memberId: z.string().uuid(),
  blockers: z
    .array(z.enum(["IURAN_TUNGGAKAN", "DOKUMEN_KURANG", "ABSENSI_KURANG"]))
    .min(1),
  note: z.string().trim().min(5).max(500),
});

export const uktRegistrationUpdateSchema = z.object({
  action: z.enum(["approve", "reject", "update_kyu", "mark_paid"]).optional(),
  categoryId: z.string().uuid().optional(),
  newRank: z.string().trim().min(2).max(64).optional(),
  /** Sabuk saat ini (Kyu Lama) dari baris UKT — untuk snapshot bila GET registrasi gagal */
  previousRank: z.string().trim().min(1).max(64).optional(),
  memberId: z.string().uuid().optional(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "PAID", "SUCCESS"]).optional(),
  examResult: z.enum(["LULUS", "GAGAL", "MENGULANG"]).optional(),
  eventId: z.string().uuid().optional(),
});

export const uktMemberCreateSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  gender: z.enum(["L", "P"]).optional(),
  birthPlace: z.string().trim().max(100).optional(),
  birthDate: z.string().optional(),
  address: z.string().trim().max(300).optional(),
  dojoId: z.string().uuid().optional(),
  nik: z
    .string()
    .trim()
    .regex(/^\d{16}$/, "NIK harus 16 digit")
    .optional()
    .or(z.literal("")),
  phoneNumber: z
    .string()
    .trim()
    .min(10, "Nomor telepon tidak valid")
    .max(20)
    .optional()
    .or(z.literal("")),
  currentRank: z.string().trim().min(2).max(64).optional(),
  nia: z
    .string()
    .trim()
    .min(2, "NIA minimal 2 karakter")
    .max(32, "NIA maksimal 32 karakter")
    .optional()
    .or(z.literal("")),
});

/** Alias semantik untuk create anggota dari Kelola Anggota / UKT */
export const adminMemberCreateSchema = uktMemberCreateSchema;

export const uktBeltFeesSchema = z.object({
  PUTIH: z.coerce.number().int().min(0).max(10_000_000),
  KUNING: z.coerce.number().int().min(0).max(10_000_000),
  HIJAU: z.coerce.number().int().min(0).max(10_000_000),
  BIRU: z.coerce.number().int().min(0).max(10_000_000),
  COKELAT: z.coerce.number().int().min(0).max(10_000_000),
  komisiRanting: z.coerce.number().int().min(0).max(1_000_000),
});

export const adminUserPatchSchema = z.object({
  userId: z.string().uuid(),
  action: z
    .enum(["update", "reset_password"])
    .optional()
    .default("update"),
  isActive: z.boolean().optional(),
  fullName: z.string().trim().min(2).max(100).optional(),
  phoneNumber: z.string().trim().max(20).optional().or(z.literal("")),
  role: z
    .enum([
      "ADMINISTRATOR",
      "ADMIN_PUSAT",
      "ADMIN_PROVINCE",
      "ADMIN_BRANCH",
      "ADMIN_DOJO",
      "ADMIN",
    ])
    .optional(),
  managedProvinceId: z.string().uuid().nullable().optional(),
  managedBranchId: z.string().uuid().nullable().optional(),
  managedDojoId: z.string().uuid().nullable().optional(),
  newPassword: z.string().min(8).max(72).optional(),
  newPasswordConfirm: z.string().min(8).max(72).optional(),
});

export const adminUserCreateSchema = z
  .object({
    email: z.string().trim().toLowerCase().email(),
    fullName: z.string().trim().min(2).max(100),
    phoneNumber: z.string().trim().max(20).optional().or(z.literal("")),
    role: z.enum([
      "ADMIN_PROVINCE",
      "ADMIN_BRANCH",
      "ADMIN_DOJO",
      "ADMIN",
    ]),
    managedProvinceId: z.string().uuid().optional().nullable(),
    managedBranchId: z.string().uuid().optional().nullable(),
    managedDojoId: z.string().uuid().optional().nullable(),
    password: z.string().min(8).max(72),
    passwordConfirm: z.string().min(8).max(72),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    message: "Konfirmasi password tidak cocok",
    path: ["passwordConfirm"],
  });

export const branchOrgProfileSchema = z.object({
  address: z.string().trim().max(300),
  phone: z.string().trim().max(30),
  whatsapp: z.string().trim().max(30),
  email: z.string().trim().email().or(z.literal("")),
  hours: z.string().trim().max(120),
  bankName: z.string().trim().max(80),
  bankAccountNumber: z.string().trim().max(40),
  bankAccountName: z.string().trim().max(120),
  paymentInstructions: z.string().trim().max(1000),
  mapsUrl: z.string().trim().max(300),
  bidangUjianName: z.string().trim().max(120),
  bendaharaCabangName: z.string().trim().max(120),
  ketuaCabangName: z.string().trim().max(120).optional().or(z.literal("")),
});

export const uktExamDaySchema = z.object({
  eventId: z.string().uuid(),
  presentRegistrationIds: z.array(z.string().uuid()).max(500).optional(),
  absentRegistrationIds: z.array(z.string().uuid()).max(500).optional(),
  examResults: z
    .array(
      z.object({
        registrationId: z.string().uuid(),
        result: z.enum(["LULUS", "GAGAL", "MENGULANG"]),
      }),
    )
    .max(500)
    .optional(),
});

export const uktDepositSchema = z.object({
  eventId: z.string().uuid(),
  dojoId: z.string().min(1).max(80),
  status: z.enum(["PENDING", "SUBMITTED", "RECEIVED"]),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

export const uktPeriodMetaSchema = z.object({
  eventId: z.string().uuid(),
  archived: z.boolean().optional(),
  locked: z.boolean().optional(),
});

export const operationalDefaultsSchema = z.object({
  monthlyDuesAmount: z.coerce.number().min(0).max(10_000_000),
  paymentInstructions: z.string().trim().max(1000),
  forcePasswordHint: z.boolean().optional(),
});

export const branchCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  provinceId: z.string().uuid(),
  headName: z.string().trim().max(120).optional().or(z.literal("")),
  adminEmail: z
    .string()
    .trim()
    .toLowerCase()
    .email()
    .optional()
    .or(z.literal("")),
  adminPassword: z.string().min(8).max(72).optional().or(z.literal("")),
});

export const branchUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  headName: z.string().trim().max(120).optional().or(z.literal("")),
  adminEmail: z.string().trim().toLowerCase().email().optional().or(z.literal("")),
  adminPassword: z.string().min(8).max(72).optional().or(z.literal("")),
});

export const rantingCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  branchId: z.string().uuid(),
  headName: z.string().trim().max(120).optional().or(z.literal("")),
  contactPerson: z.string().trim().max(120).optional().or(z.literal("")),
  address: z.string().trim().max(300).optional().or(z.literal("")),
  kecamatan: z.string().trim().max(120).optional().or(z.literal("")),
  tempatLatihan: z.string().trim().max(200).optional().or(z.literal("")),
  phoneNumber: z.string().trim().max(20).optional().or(z.literal("")),
  schedule: z.string().trim().max(200).optional().or(z.literal("")),
  bankName: z.string().trim().max(80).optional().or(z.literal("")),
  bankAccountNumber: z.string().trim().max(40).optional().or(z.literal("")),
  bankAccountName: z.string().trim().max(120).optional().or(z.literal("")),
  adminEmail: z
    .string()
    .trim()
    .toLowerCase()
    .email("Username login harus berupa email")
    .optional()
    .or(z.literal("")),
  adminPassword: z.string().min(8).max(72).optional().or(z.literal("")),
  adminPasswordConfirm: z.string().min(8).max(72).optional().or(z.literal("")),
}).refine(
  (d) =>
    !d.adminPassword ||
    !d.adminPasswordConfirm ||
    d.adminPassword === d.adminPasswordConfirm,
  {
    message: "Konfirmasi password tidak cocok",
    path: ["adminPasswordConfirm"],
  },
);

export const rantingUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  headName: z.string().trim().max(120).optional().or(z.literal("")),
  contactPerson: z.string().trim().max(120).optional().or(z.literal("")),
  address: z.string().trim().max(300).optional().or(z.literal("")),
  kecamatan: z.string().trim().max(120).optional().or(z.literal("")),
  tempatLatihan: z.string().trim().max(200).optional().or(z.literal("")),
  phoneNumber: z.string().trim().max(20).optional().or(z.literal("")),
  schedule: z.string().trim().max(200).optional().or(z.literal("")),
  bankName: z.string().trim().max(80).optional().or(z.literal("")),
  bankAccountNumber: z.string().trim().max(40).optional().or(z.literal("")),
  bankAccountName: z.string().trim().max(120).optional().or(z.literal("")),
  adminEmail: z.string().trim().toLowerCase().email().optional().or(z.literal("")),
  adminPassword: z.string().min(8).max(72).optional().or(z.literal("")),
});

/** Cabang membuat/mengganti akun login admin ranting */
export const rantingLoginSchema = z
  .object({
    dojoId: z.string().uuid(),
    adminEmail: z.string().trim().toLowerCase().email("Username login harus berupa email"),
    adminPassword: z.string().min(8).max(72),
    adminPasswordConfirm: z.string().min(8).max(72),
  })
  .refine((d) => d.adminPassword === d.adminPasswordConfirm, {
    message: "Konfirmasi password tidak cocok",
    path: ["adminPasswordConfirm"],
  });

export const rantingResetPasswordSchema = z
  .object({
    dojoId: z.string().uuid(),
    adminPassword: z.string().min(8).max(72),
    adminPasswordConfirm: z.string().min(8).max(72),
  })
  .refine((d) => d.adminPassword === d.adminPasswordConfirm, {
    message: "Konfirmasi password tidak cocok",
    path: ["adminPasswordConfirm"],
  });

export const softDeleteSchema = z.object({
  id: z.string().uuid(),
  restore: z.boolean().optional(),
});

export const akunProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  phoneNumber: z.string().trim().min(10).max(20).optional().or(z.literal("")),
});

export const akunPasswordSchema = z
  .object({
    oldPassword: z.string().min(1),
    newPassword: z.string().min(8).max(72),
    newPasswordConfirm: z.string().min(8).max(72),
  })
  .refine((d) => d.newPassword === d.newPasswordConfirm, {
    message: "Konfirmasi password baru tidak cocok",
    path: ["newPasswordConfirm"],
  });

export const rolePermissionsSchema = z.object({
  permissionIds: z.array(z.string().uuid()),
});

export const geofencingSchema = z.object({
  dojoId: z.string().uuid(),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  geofenceRadius: z.coerce.number().int().min(10).max(5000),
});

export const wilayahAccountCreateSchema = z
  .object({
    scope: z.enum(["branch", "dojo"]),
    wilayahId: z.string().uuid(),
    email: z.string().trim().toLowerCase().email(),
    fullName: z.string().trim().min(2).max(100),
    phoneNumber: z.string().trim().max(20).optional().or(z.literal("")),
    password: z.string().min(8).max(72),
    passwordConfirm: z.string().min(8).max(72),
    setAsPrimary: z.boolean().optional(),
    jabatan: z
      .enum(["KETUA", "SEKRETARIS", "BENDAHARA", "PENGURUS"])
      .optional()
      .nullable(),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    message: "Konfirmasi password tidak cocok",
    path: ["passwordConfirm"],
  });

export const wilayahAccountPatchSchema = z.object({
  scope: z.enum(["branch", "dojo"]),
  wilayahId: z.string().uuid(),
  userId: z.string().uuid(),
  action: z.enum([
    "activate",
    "deactivate",
    "set_primary",
    "reset_password",
    "set_jabatan",
    "handover",
    "change_email",
  ]),
  newPassword: z.string().min(8).max(72).optional(),
  newPasswordConfirm: z.string().min(8).max(72).optional(),
  /** Email baru untuk action change_email */
  newEmail: z
    .string()
    .trim()
    .toLowerCase()
    .email("Format email tidak valid")
    .optional(),
  jabatan: z
    .enum(["KETUA", "SEKRETARIS", "BENDAHARA", "PENGURUS"])
    .optional()
    .nullable(),
  note: z.string().trim().max(500).optional().or(z.literal("")),
  deactivatePrevious: z.boolean().optional(),
});

export const memberBillingProofSchema = z.object({
  proofUrl: z.string().url("URL bukti tidak valid"),
  paymentMethod: z.string().trim().max(40).optional(),
});

export const adminBillingPatchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.enum(["approve", "reject", "mark_paid"]),
    adminNotes: z.string().trim().max(500).optional(),
  }),
  z.object({
    action: z.literal("update"),
    amount: z.coerce.number().min(0).max(50_000_000).optional(),
    dueDate: z.string().min(1).optional(),
    description: z.string().trim().max(500).optional().nullable(),
    adminNotes: z.string().trim().max(500).optional(),
  }),
]);

export const memberAttendanceCheckinSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  method: z.enum(["QR_SCAN", "GPS", "MANUAL"]).optional(),
  qrPayload: z.string().trim().max(500).optional(),
  dojoId: z.string().uuid().optional(),
  eventId: z.string().uuid().optional(),
});
