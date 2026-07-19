/** Shared Prisma/DB error classification — safe for client + server. */

export function errorMessageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error ?? "");
}

/** Pool exhaustion / unreachable DB — safe to tell users "database sibuk". */
export function isPrismaBusyError(error: unknown): boolean {
  const lower = errorMessageOf(error).toLowerCase();
  return (
    lower.includes("max clients") ||
    lower.includes("connection pool") ||
    lower.includes("timed out fetching a new connection") ||
    lower.includes("too many connections") ||
    lower.includes("p2024") ||
    lower.includes("p1001") ||
    lower.includes("can't reach database") ||
    lower.includes("pool_timeout") ||
    (lower.includes("pool") && lower.includes("timeout"))
  );
}

/** Warning for pengaturan cabang/ranting when username/admin emails fail to load. */
export function settingsUsernameLoadWarning(
  listNoun: "ranting" | "cabang",
  error?: unknown,
): string {
  if (error === undefined || isPrismaBusyError(error)) {
    return `Data username login sementara tidak tersedia (database sibuk). Daftar ${listNoun} tetap ditampilkan.`;
  }
  return `Data username login gagal dimuat. Daftar ${listNoun} tetap ditampilkan — coba refresh. Jika berulang, periksa log server.`;
}
