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

/**
 * Simple memorable password from a name seed, e.g. "AIRLANGGA" → "Airlangga123".
 * Includes uppercase + lowercase + digits (backend-compatible).
 */
export function generateSimplePassword(seed?: string | null): string {
  const raw = (seed || "Inkai").trim();
  const firstToken =
    raw.split(/[\s/|\\,_.-]+/).find((part) => /[a-zA-Z]/.test(part)) || "Inkai";
  const lettersOnly = firstToken.replace(/[^a-zA-Z]/g, "") || "Inkai";
  const base =
    lettersOnly.charAt(0).toUpperCase() + lettersOnly.slice(1).toLowerCase();
  let password = `${base}123`;
  if (password.length < 8) {
    password = `${base}${"12345678".slice(0, Math.max(0, 8 - base.length))}`;
  }
  return validatePassword(password).valid ? password : "InkaiSby123";
}

/** @deprecated Prefer generateSimplePassword for admin UX */
export function generatePassword(length = 10): string {
  return generateSimplePassword(`Pass${length}`);
}
