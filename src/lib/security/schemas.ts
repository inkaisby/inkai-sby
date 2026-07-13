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
