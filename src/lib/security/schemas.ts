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
