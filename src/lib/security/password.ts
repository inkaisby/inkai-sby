import { randomInt } from "crypto";
import bcrypt from "bcryptjs";

const BLOCKED_PASSWORDS = new Set([
  "password",
  "123456",
  "12345678",
  "qwerty",
  "admin123",
  "inkai123",
  "surabaya",
]);

export type PasswordValidation = {
  valid: boolean;
  error?: string;
};

export function normalizeNiaKey(nia: string): string {
  return nia.trim();
}

/** True only when password exactly matches the member NIA (default-login path). */
export function assertDefaultNiaPassword(
  password: string,
  nia: string | null | undefined,
): boolean {
  if (!nia?.trim() || !password) return false;
  return normalizeNiaKey(password).toLowerCase() === normalizeNiaKey(nia).toLowerCase();
}

export async function isPasswordEqualToNia(
  passwordHash: string | null | undefined,
  nia: string | null | undefined,
): Promise<boolean> {
  if (!passwordHash || !nia?.trim()) return false;
  try {
    return await bcrypt.compare(normalizeNiaKey(nia), passwordHash);
  } catch {
    return false;
  }
}

/**
 * Strong password rules for register / self-change / admin accounts.
 * Does NOT accept NIA-style defaults — use assertDefaultNiaPassword for those.
 */
export function validatePassword(password: string): PasswordValidation {
  if (password.length < 8) {
    return { valid: false, error: "Password minimal 8 karakter" };
  }

  if (password.length > 128) {
    return { valid: false, error: "Password terlalu panjang" };
  }

  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return {
      valid: false,
      error: "Password harus mengandung huruf dan angka",
    };
  }

  if (BLOCKED_PASSWORDS.has(password.toLowerCase())) {
    return { valid: false, error: "Password terlalu umum, pilih yang lebih kuat" };
  }

  return { valid: true };
}

/** Self-change: strong + must not equal member NIA. */
export function validateMemberSelfPassword(
  password: string,
  nia: string | null | undefined,
): PasswordValidation {
  if (assertDefaultNiaPassword(password, nia)) {
    return {
      valid: false,
      error: "Password baru tidak boleh sama dengan NIA. Pilih password yang lebih kuat.",
    };
  }
  return validatePassword(password);
}

/**
 * Deterministic UI hint only (e.g. "Pola: Name####"). Not for actual credentials.
 */
export function passwordPatternHint(seed?: string | null): string {
  const raw = (seed || "Inkai").trim();
  const firstToken =
    raw.split(/[\s/|\\,_.-]+/).find((part) => /[a-zA-Z]/.test(part)) || "Inkai";
  const lettersOnly = firstToken.replace(/[^a-zA-Z]/g, "") || "Inkai";
  const base =
    lettersOnly.charAt(0).toUpperCase() + lettersOnly.slice(1).toLowerCase();
  return `${base}####`;
}

/**
 * Memorable-ish temp password: Name + 4 random digits (not Name123).
 * Callers should tell the user to change it after first login.
 */
export function generateSimplePassword(seed?: string | null): string {
  const raw = (seed || "Inkai").trim();
  const firstToken =
    raw.split(/[\s/|\\,_.-]+/).find((part) => /[a-zA-Z]/.test(part)) || "Inkai";
  const lettersOnly = firstToken.replace(/[^a-zA-Z]/g, "") || "Inkai";
  const base =
    lettersOnly.charAt(0).toUpperCase() + lettersOnly.slice(1).toLowerCase();
  for (let attempt = 0; attempt < 8; attempt++) {
    const password = `${base}${randomInt(1000, 10000)}`;
    if (validatePassword(password).valid) return password;
  }
  return `Inkai${randomInt(1000, 10000)}Sby`;
}

/** @deprecated Prefer generateSimplePassword for admin UX */
export function generatePassword(length = 10): string {
  return generateSimplePassword(`Pass${length}`);
}
