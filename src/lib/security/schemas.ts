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
    .max(15)
    .optional()
    .or(z.literal("")),
  gender: z.enum(["L", "P"]).optional().or(z.literal("")),
  birthDate: z.string().optional().or(z.literal("")),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Format email tidak valid"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

export const memberActionSchema = z.object({
  action: z.enum(["approve", "reject"]),
  nia: z.string().trim().max(32).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const uktPeriodSchema = z.object({
  semester: z.enum(["I", "II"]),
  year: z.coerce.number().int().min(2020).max(2100),
  title: z.string().trim().min(3).max(120).optional(),
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

export const uktRegistrationUpdateSchema = z.object({
  action: z.enum(["approve", "reject", "update_kyu", "mark_paid"]).optional(),
  categoryId: z.string().uuid().optional(),
  newRank: z.string().trim().min(2).max(64).optional(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "PAID", "SUCCESS"]).optional(),
});

export const uktMemberCreateSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  gender: z.enum(["L", "P"]).optional(),
  birthPlace: z.string().trim().max(100).optional(),
  birthDate: z.string().optional(),
  address: z.string().trim().max(300).optional(),
  dojoId: z.string().uuid().optional(),
});

export const uktBeltFeesSchema = z.object({
  PUTIH: z.coerce.number().int().min(0).max(10_000_000),
  KUNING: z.coerce.number().int().min(0).max(10_000_000),
  HIJAU: z.coerce.number().int().min(0).max(10_000_000),
  BIRU: z.coerce.number().int().min(0).max(10_000_000),
  COKELAT: z.coerce.number().int().min(0).max(10_000_000),
  komisiRanting: z.coerce.number().int().min(0).max(1_000_000),
});

export const uktInvoiceAckSchema = z.object({
  eventId: z.string().uuid(),
  dojoId: z.string().uuid(),
  acknowledged: z.boolean(),
});

export const adminUserPatchSchema = z.object({
  userId: z.string().uuid(),
  isActive: z.boolean().optional(),
  fullName: z.string().trim().min(2).max(100).optional(),
});

export const branchCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  provinceId: z.string().uuid(),
  headName: z.string().trim().max(120).optional().or(z.literal("")),
  adminEmail: z.string().trim().toLowerCase().email(),
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
  adminEmail: z.string().trim().toLowerCase().email("Username login harus berupa email"),
  adminPassword: z.string().min(8).max(72),
  adminPasswordConfirm: z.string().min(8).max(72),
}).refine((d) => d.adminPassword === d.adminPasswordConfirm, {
  message: "Konfirmasi password tidak cocok",
  path: ["adminPasswordConfirm"],
});

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
