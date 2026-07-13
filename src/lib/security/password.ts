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
