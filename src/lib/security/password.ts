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

/** Generates a readable password that passes validatePassword (letters + digits). */
export function generatePassword(length = 10): string {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const all = letters + digits;
  const pick = (charset: string) =>
    charset[Math.floor(Math.random() * charset.length)]!;

  const chars: string[] = [pick(letters), pick(digits)];
  const size = Math.max(8, length);
  for (let i = chars.length; i < size; i++) {
    chars.push(pick(all));
  }

  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }

  const password = chars.join("");
  return validatePassword(password).valid ? password : generatePassword(length);
}
