/** Kode singkat di URL NextAuth — jangan isi data sensitif. */
export const LOGIN_ERROR_CODE = {
  credentials: "credentials",
  rate_limited: "rate_limited",
  disabled: "disabled",
  server_error: "server_error",
  blocked: "blocked",
} as const;

export type LoginErrorCode =
  (typeof LOGIN_ERROR_CODE)[keyof typeof LOGIN_ERROR_CODE];

const MESSAGES: Record<string, string> = {
  [LOGIN_ERROR_CODE.credentials]: "Email/NIA atau password salah.",
  [LOGIN_ERROR_CODE.rate_limited]:
    "Terlalu banyak percobaan login. Tunggu beberapa menit lalu coba lagi.",
  [LOGIN_ERROR_CODE.disabled]: "Akun dinonaktifkan. Hubungi admin.",
  [LOGIN_ERROR_CODE.server_error]:
    "Server autentikasi sedang bermasalah. Coba lagi beberapa menit.",
  [LOGIN_ERROR_CODE.blocked]:
    "Akun anggota tidak aktif. Hubungi admin ranting/cabang.",
};

export function loginErrorMessage(code?: string | null): string {
  if (code && MESSAGES[code]) return MESSAGES[code];
  return MESSAGES[LOGIN_ERROR_CODE.credentials];
}
