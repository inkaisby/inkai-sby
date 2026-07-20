/** Production inkai-backend — override via INKAI_API_URL / NEXT_PUBLIC_INKAI_API_URL. */
const DEFAULT_INKAI_API_URL = "https://inkai-ecosystem.vercel.app";
const INKAI_FETCH_TIMEOUT_MS = 12_000;

export function getInkaiApiBaseUrl(): string {
  const url =
    process.env.INKAI_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_INKAI_API_URL?.trim() ||
    (process.env.VERCEL ? DEFAULT_INKAI_API_URL : "");
  if (!url) {
    throw new Error(
      "INKAI_API_URL belum diset. Tambahkan ke .env.local (dev) atau Vercel Environment Variables.",
    );
  }
  return url.replace(/\/$/, "");
}

export type InkaiFetchResult = {
  res: Response;
  data: Record<string, unknown>;
};

export type InkaiFetchOptions = {
  timeoutMs?: number;
  /** Extra attempts after the first failure (network / abort). Default 1. */
  retries?: number;
  /**
   * When true, network/timeout errors rethrow instead of returning HTTP 503.
   * Prefer soft-fail (default) for SSR pages so menus stay usable.
   */
  throwOnNetworkError?: boolean;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableFetchError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const name = error.name.toLowerCase();
  const message = error.message.toLowerCase();
  return (
    name === "aborterror" ||
    message.includes("aborted") ||
    message.includes("timeout") ||
    message.includes("fetch failed") ||
    message.includes("network") ||
    message.includes("econnreset") ||
    message.includes("socket")
  );
}

function unavailableResult(path: string, error: unknown): InkaiFetchResult {
  const message =
    error instanceof Error ? error.message : "Inkai API unavailable";
  console.error(`[inkaiFetch] ${path}`, error);
  return {
    res: new Response(JSON.stringify({ error: message }), {
      status: 503,
      statusText: "Service Unavailable",
      headers: { "Content-Type": "application/json" },
    }),
    data: { error: message, path },
  };
}

async function inkaiFetchOnce(
  path: string,
  init: RequestInit,
  token: string | null | undefined,
  timeoutMs: number,
): Promise<InkaiFetchResult> {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${getInkaiApiBaseUrl()}${path}`, {
      ...init,
      headers,
      cache: "no-store",
      signal: controller.signal,
    });

    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { res, data };
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "AbortError" ||
        error.message.toLowerCase().includes("aborted"))
    ) {
      throw new Error(
        `Timed out fetching Inkai API ${path} after ${timeoutMs}ms`,
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fetch Inkai backend. Network/timeout failures soft-fail as HTTP 503 by default
 * so SSR pages/menus degrade instead of crashing the whole segment.
 */
export async function inkaiFetch(
  path: string,
  init: RequestInit = {},
  token?: string | null,
  options: InkaiFetchOptions = {},
): Promise<InkaiFetchResult> {
  const timeoutMs = options.timeoutMs ?? INKAI_FETCH_TIMEOUT_MS;
  const retries = Math.max(0, options.retries ?? 1);
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await inkaiFetchOnce(path, init, token, timeoutMs);
    } catch (error) {
      lastError = error;
      if (attempt < retries && isRetryableFetchError(error)) {
        await sleep(400 * (attempt + 1));
        continue;
      }
      break;
    }
  }

  if (options.throwOnNetworkError) {
    throw lastError instanceof Error
      ? lastError
      : new Error("Inkai API request failed");
  }

  return unavailableResult(path, lastError);
}

export function inkaiErrorMessage(
  data: Record<string, unknown>,
  fallback: string,
) {
  if (typeof data.message === "string" && data.message.trim()) {
    return friendlyInkaiValidationMessage(data.message);
  }
  if (typeof data.error === "string" && data.error.trim()) {
    return friendlyInkaiValidationMessage(data.error);
  }
  // Zod-style issues dari Inkai: [{ path, message }]
  const issues = data.issues ?? data.errors;
  if (Array.isArray(issues) && issues.length > 0) {
    const parts = issues
      .map((issue) => {
        if (!issue || typeof issue !== "object") return null;
        const row = issue as { path?: unknown; message?: unknown };
        const msg =
          typeof row.message === "string" ? row.message.trim() : "";
        if (!msg) return null;
        const path = Array.isArray(row.path)
          ? row.path.filter((p) => typeof p === "string" || typeof p === "number").join(".")
          : "";
        return friendlyInkaiValidationMessage(path ? `${path}: ${msg}` : msg);
      })
      .filter(Boolean);
    if (parts.length > 0) return parts.join("; ");
  }
  return fallback;
}

/** Ubah pesan validasi teknis Inkai/Zod jadi lebih mudah dibaca. */
function friendlyInkaiValidationMessage(raw: string): string {
  const text = raw.trim();
  const lower = text.toLowerCase();

  if (
    /\bname\b/i.test(text) &&
    (lower.includes("too small") || lower.includes("minimal") || lower.includes(">=2"))
  ) {
    return "Nama tidak valid (minimal 2 karakter). Periksa kolom Nama Lengkap.";
  }
  if (
    /\bfullname\b/i.test(text) &&
    (lower.includes("too small") || lower.includes(">=2"))
  ) {
    return "Nama tidak valid (minimal 2 karakter).";
  }
  if (
    /\bcurrentrank\b/i.test(text) ||
    (/\brank\b/i.test(text) && lower.includes("too small"))
  ) {
    return "Kyu/DAN tidak valid. Isi mis. Kyu 4, Biru, atau DAN 1.";
  }
  if (lower.includes("too small: expected string to have >=2 characters")) {
    return "Ada field wajib yang terlalu pendek (minimal 2 karakter).";
  }
  return text;
}
