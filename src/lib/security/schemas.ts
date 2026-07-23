import { z } from "zod";

/** String opsional: "" / null → undefined; jika ada isi harus lolos schema dalam. */
function optionalBlankString<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess((v) => {
    if (v === null || v === undefined) return undefined;
    if (typeof v === "string" && v.trim() === "") return undefined;
    return v;
  }, schema.optional());
}

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
  password: z
    .string()
    .min(8, "Password minimal 8 karakter")
    .max(128, "Password terlalu panjang"),
  dojoId: z.string().uuid("Dojo tidak valid"),
  /** Daftar mandiri: NIK wajib 16 digit. */
  nik: z.string().trim().regex(/^\d{16}$/, "NIK harus 16 digit"),
  phoneNumber: z
    .string()
    .trim()
    .min(10, "Nomor telepon tidak valid")
    .max(20),
  gender: z.enum(["L", "P"], { message: "Jenis kelamin wajib dipilih" }),
  birthPlace: z
    .string()
    .trim()
    .min(2, "Tempat lahir wajib diisi")
    .max(100),
  birthDate: z.string().trim().min(8, "Tanggal lahir wajib diisi"),
  address: z.string().trim().min(5, "Alamat wajib diisi").max(300),
  currentRank: z.string().trim().min(2).max(64).optional(),
  /** NIA tetap opsional — calon sering belum punya. */
  nia: optionalBlankString(
    z
      .string()
      .trim()
      .min(2, "NIA minimal 2 karakter")
      .max(32, "NIA maksimal 32 karakter"),
  ),
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
    "set_msh",
    "set_name",
    "set_rank",
    "set_dues",
    "set_dues_exemption",
    "set_documents",
    "set_dojo",
    "reset_password",
    "deactivate",
    "activate",
    "delete",
    "restore",
  ]),
  nia: z.string().trim().max(32).optional(),
  /** Nama lengkap anggota (ranting/cabang). */
  fullName: z.string().trim().min(2).max(100).optional(),
  /** No. MSH — sabuk Hitam/DAN (ranting/cabang). Kosong = hapus. */
  mshNumber: z.string().trim().max(32).optional().nullable(),
  /** Sabuk / Kyu resmi anggota (hanya cabang). */
  currentRank: z.string().trim().min(2).max(64).optional(),
  /** Nominal iuran bulanan per anggota (ranting/cabang). */
  monthlyDuesAmount: z.coerce.number().min(0).max(10_000_000).optional(),
  /** Pengecualian iuran — daftar event/UKT tanpa lunas iuran bulanan. */
  allowEventWithoutDues: z.boolean().optional(),
  /** Pindah ranting (hanya cabang ke atas). */
  dojoId: z.string().uuid().optional(),
  /** URL dokumen (setelah upload Blob) — kosong = hapus. */
  birthCertificateUrl: z.string().trim().max(2048).optional().nullable(),
  bpjsCardUrl: z.string().trim().max(2048).optional().nullable(),
  bpjsCardNumber: z.string().trim().max(32).optional().nullable(),
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
  action: z.enum(["deactivate", "approve", "delete", "purge", "restore"]),
  memberIds: z.array(z.string().uuid()).min(1),
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
  /** Bulk arsip: ARSIPKAN; bulk hapus permanen arsip: HAPUS. */
  confirmPhrase: z.string().trim().max(40).optional(),
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
  /** Buka pendaftaran (ISO). Default: awal semester — disimpan di period-meta. */
  registrationOpenAt: z.string().datetime().optional(),
  examAt: z.string().datetime().optional().nullable(),
  examLocation: z.string().trim().max(200).optional().nullable(),
  bidangUjianName: z.string().trim().max(120).optional().nullable(),
  bendaharaCabangName: z.string().trim().max(120).optional().nullable(),
  beltFees: z
    .object({
      PUTIH: z.coerce.number().int().min(0).max(10_000_000),
      KUNING: z.coerce.number().int().min(0).max(10_000_000),
      HIJAU: z.coerce.number().int().min(0).max(10_000_000),
      BIRU: z.coerce.number().int().min(0).max(10_000_000),
      COKELAT: z.coerce.number().int().min(0).max(10_000_000),
    })
    .optional(),
  komisiRanting: z.coerce.number().int().min(0).max(1_000_000).optional(),
  notifyRanting: z.boolean().optional(),
});

export const uktPeriodPatchSchema = z.object({
  eventId: z.string().uuid(),
  title: z.string().trim().min(3).max(120).optional(),
  registrationCloseAt: z.string().datetime().optional(),
  registrationOpenAt: z.string().datetime().optional().nullable(),
  examAt: z.string().datetime().optional().nullable(),
  examLocation: z.string().trim().max(200).optional().nullable(),
  bidangUjianName: z.string().trim().max(120).optional().nullable(),
  bendaharaCabangName: z.string().trim().max(120).optional().nullable(),
  beltFees: z
    .object({
      PUTIH: z.coerce.number().int().min(0).max(10_000_000),
      KUNING: z.coerce.number().int().min(0).max(10_000_000),
      HIJAU: z.coerce.number().int().min(0).max(10_000_000),
      BIRU: z.coerce.number().int().min(0).max(10_000_000),
      COKELAT: z.coerce.number().int().min(0).max(10_000_000),
    })
    .optional(),
  komisiRanting: z.coerce.number().int().min(0).max(1_000_000).optional(),
  notifyRanting: z.boolean().optional(),
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
  action: z
    .enum(["approve", "reject", "update_kyu", "mark_paid", "submit_for_verification"])
    .optional(),
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
  fullName: z
    .string()
    .trim()
    .min(2, "Nama minimal 2 karakter")
    .max(100, "Nama terlalu panjang"),
  gender: optionalBlankString(z.enum(["L", "P"])),
  birthPlace: optionalBlankString(z.string().trim().max(100)),
  birthDate: optionalBlankString(z.string()),
  address: optionalBlankString(z.string().trim().max(300)),
  dojoId: z.string().uuid().optional(),
  /** Opsional untuk ranting/cabang — kosong boleh. */
  nik: optionalBlankString(
    z.string().trim().regex(/^\d{16}$/, "NIK harus 16 digit"),
  ),
  phoneNumber: optionalBlankString(
    z.string().trim().min(10, "Nomor telepon tidak valid").max(20),
  ),
  currentRank: optionalBlankString(
    z
      .string()
      .trim()
      .min(2, "Kyu/DAN tidak valid")
      .max(64),
  ),
  nia: optionalBlankString(
    z
      .string()
      .trim()
      .min(2, "NIA minimal 2 karakter")
      .max(32, "NIA maksimal 32 karakter"),
  ),
});

/** Alias semantik untuk create anggota dari Kelola Anggota / UKT */
export const adminMemberCreateSchema = uktMemberCreateSchema;

/** Input massal tambah anggota (maks 50 baris / request). */
export const adminMemberBulkCreateSchema = z.object({
  members: z
    .array(uktMemberCreateSchema)
    .min(1, "Minimal 1 baris")
    .max(50, "Maksimal 50 anggota per unggah"),
});

export const uktBeltFeesSchema = z.object({
  PUTIH: z.coerce.number().int().min(0).max(10_000_000),
  KUNING: z.coerce.number().int().min(0).max(10_000_000),
  HIJAU: z.coerce.number().int().min(0).max(10_000_000),
  BIRU: z.coerce.number().int().min(0).max(10_000_000),
  COKELAT: z.coerce.number().int().min(0).max(10_000_000),
  komisiRanting: z.coerce.number().int().min(0).max(1_000_000),
  /** Jika diisi: simpan juga sebagai snapshot biaya periode. */
  eventId: z.string().uuid().optional(),
  /** true = juga update template global cabang. Default: true jika tanpa eventId. */
  updateGlobal: z.boolean().optional(),
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
  registrationOpenAt: z.string().datetime().optional().nullable(),
  examAt: z.string().datetime().optional().nullable(),
  examLocation: z.string().trim().max(200).optional().nullable(),
  bidangUjianName: z.string().trim().max(120).optional().nullable(),
  bendaharaCabangName: z.string().trim().max(120).optional().nullable(),
  beltFees: z
    .object({
      PUTIH: z.coerce.number().int().min(0).max(10_000_000),
      KUNING: z.coerce.number().int().min(0).max(10_000_000),
      HIJAU: z.coerce.number().int().min(0).max(10_000_000),
      BIRU: z.coerce.number().int().min(0).max(10_000_000),
      COKELAT: z.coerce.number().int().min(0).max(10_000_000),
    })
    .optional(),
  komisiRanting: z.coerce.number().int().min(0).max(1_000_000).optional(),
  notifiedOpenAt: z.string().datetime().optional().nullable(),
  notifiedCloseReminderAt: z.string().datetime().optional().nullable(),
  notifiedExtendedAt: z.string().datetime().optional().nullable(),
});

export const uktRegistrationPolicySchema = z.object({
  requireNoOutstandingDues: z.boolean(),
  requireDocuments: z.boolean(),
  requireMinAttendance: z.boolean(),
  enforceForRanting: z.boolean(),
  enforceForCabang: z.boolean(),
  minAttendancePct: z.coerce.number().int().min(0).max(100).optional(),
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
  phoneNumber: z
    .string()
    .trim()
    .max(60, "Telepon maksimal 60 karakter (boleh beberapa nomor dipisah / atau ,)")
    .optional()
    .or(z.literal("")),
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
  phoneNumber: z
    .string()
    .trim()
    .max(60, "Telepon maksimal 60 karakter (boleh beberapa nomor dipisah / atau ,)")
    .optional()
    .or(z.literal("")),
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
  /** Hapus permanen dari arsip (bukan soft-delete). */
  permanent: z.boolean().optional(),
});

export const akunProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  phoneNumber: z.string().trim().min(10).max(20).optional().or(z.literal("")),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Email tidak valid")
    .optional()
    .or(z.literal("")),
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
    adminGrants: z
      .object({
        editProfile: z.boolean().optional(),
        crud: z.boolean().optional(),
        sidebarPaths: z.array(z.string()).max(32).optional(),
      })
      .optional(),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    message: "Konfirmasi password tidak cocok",
    path: ["passwordConfirm"],
  });

export const wilayahAccountPatchSchema = z
  .object({
    scope: z.enum(["branch", "dojo"]),
    wilayahId: z.string().uuid(),
    userId: z.string().uuid().optional(),
    action: z.enum([
      "activate",
      "deactivate",
      "set_primary",
      "reset_password",
      "set_jabatan",
      "handover",
      "change_email",
      "set_managed_dojos",
      "link_existing",
      "promote_existing",
      "unlink_dojo",
      "set_admin_grants",
    ]),
    newPassword: z.string().min(8).max(72).optional(),
    newPasswordConfirm: z.string().min(8).max(72).optional(),
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
    managedDojoIds: z.array(z.string().uuid()).max(50).optional(),
    primaryDojoId: z.string().uuid().optional(),
    linkEmail: z
      .string()
      .trim()
      .toLowerCase()
      .email("Format email tidak valid")
      .optional(),
    setAsPrimary: z.boolean().optional(),
    adminGrants: z
      .object({
        editProfile: z.boolean().optional(),
        crud: z.boolean().optional(),
        sidebarPaths: z.array(z.string()).max(32).optional(),
      })
      .optional(),
  })
  .superRefine((d, ctx) => {
    if (d.action === "link_existing" || d.action === "promote_existing") {
      if (!d.linkEmail) {
        ctx.addIssue({
          code: "custom",
          message: "Email akun wajib diisi",
          path: ["linkEmail"],
        });
      }
      return;
    }
    if (!d.userId) {
      ctx.addIssue({
        code: "custom",
        message: "userId wajib",
        path: ["userId"],
      });
    }
    if (d.action === "set_managed_dojos") {
      if (!d.managedDojoIds?.length) {
        ctx.addIssue({
          code: "custom",
          message: "Pilih minimal satu ranting",
          path: ["managedDojoIds"],
        });
      }
      if (!d.primaryDojoId) {
        ctx.addIssue({
          code: "custom",
          message: "Ranting utama wajib",
          path: ["primaryDojoId"],
        });
      }
    }
  });

export const memberBillingProofSchema = z.object({
  proofUrl: z.string().url("URL bukti tidak valid"),
  paymentMethod: z.string().trim().max(40).optional(),
});

/** PATCH profil anggota sendiri. Email/NIA/sabuk/MSH: edit mandiri maks. 1x. */
export const memberSelfProfileSchema = z.object({
  fullName: optionalBlankString(
    z
      .string()
      .trim()
      .min(2, "Nama minimal 2 karakter")
      .max(100, "Nama terlalu panjang"),
  ),
  gender: optionalBlankString(z.enum(["L", "P"])),
  birthPlace: optionalBlankString(z.string().trim().max(100)),
  birthDate: optionalBlankString(z.string().trim().min(8).max(32)),
  address: optionalBlankString(z.string().trim().max(300)),
  phoneNumber: optionalBlankString(
    z.string().trim().min(10, "Nomor telepon tidak valid").max(20),
  ),
  /** Kosong = hapus NIK; isi harus 16 digit. */
  nik: z
    .union([
      z.literal(""),
      z.null(),
      z.string().trim().regex(/^\d{16}$/, "NIK harus 16 digit"),
    ])
    .optional(),
  photoUrl: z.string().trim().max(2048).optional().nullable(),
  birthCertificateUrl: z.string().trim().max(2048).optional().nullable(),
  bpjsCardUrl: z.string().trim().max(2048).optional().nullable(),
  bpjsCardNumber: z.string().trim().max(32).optional().nullable(),
  /** Edit mandiri 1x — setelah terkunci lewat pengajuan. */
  email: optionalBlankString(z.string().trim().toLowerCase().email().max(254)),
  nia: optionalBlankString(z.string().trim().min(2).max(32)),
  currentRank: optionalBlankString(z.string().trim().min(2).max(64)),
  mshNumber: optionalBlankString(z.string().trim().min(2).max(32)),
});

/** Pengajuan perubahan email / NIA / sabuk / No. MSH setelah kunci 1x. */
export const memberProfileChangeSchema = z
  .object({
    reason: z.string().trim().min(5, "Alasan minimal 5 karakter").max(500),
    email: optionalBlankString(z.string().trim().toLowerCase().email().max(254)),
    nia: optionalBlankString(z.string().trim().min(2).max(32)),
    currentRank: optionalBlankString(z.string().trim().min(2).max(64)),
    mshNumber: optionalBlankString(z.string().trim().min(2).max(32)),
    proofUrl: z.string().url().optional().or(z.literal("")),
  })
  .refine(
    (v) => Boolean(v.email || v.nia || v.currentRank || v.mshNumber),
    { message: "Pilih minimal satu field yang diajukan perubahannya" },
  );

export const adminBillingPatchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.enum(["approve", "reject", "mark_paid"]),
    adminNotes: z.string().trim().max(500).optional(),
  }),
  z.object({
    /** Ranting: ajukan pembayaran ke cabang (Menunggu Verifikasi), bukan lunas. */
    action: z.literal("submit_for_verification"),
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
