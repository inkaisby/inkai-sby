import { NextResponse } from "next/server";
import {
  inkaiServiceTokenFromEnv,
  portalStatusFromInkai,
  shouldPreferServiceToken,
} from "@/lib/inkai-api/auth-gateway";

export {
  decodeJwtExpSeconds,
  isInkaiTokenSoftValid,
  shouldPreferServiceToken,
  portalStatusFromInkai,
  shouldAutoEnterPortal,
  inkaiServiceTokenFromEnv,
  INKAI_JWT_NEAR_EXPIRY_SEC,
} from "@/lib/inkai-api/auth-gateway";

/** Production inkai-backend — override via INKAI_API_URL / NEXT_PUBLIC_INKAI_API_URL. */
const DEFAULT_INKAI_API_URL = "https://inkai-ecosystem.vercel.app";
const INKAI_FETCH_TIMEOUT_MS = 12_000;

export function inkaiServiceToken(): string | null {
  const t = inkaiServiceTokenFromEnv();
  if (!t && process.env.VERCEL_ENV === "production") {
    console.error(
      "[inkaiServiceToken] INKAI_SERVICE_TOKEN / CRON_INKAI_TOKEN missing in production",
    );
  }
  return t;
}

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

/**
 * Admin mutations: on auth/503/5xx Inkai failure, persist to Prisma and return 200.
 * Hard-fail only on 4xx that are not auth-related (validation, scope, etc.).
 */
export function shouldApplyInkaiPrismaFallback(
  res: { status: number },
  data?: Record<string, unknown> | null,
): boolean {
  if (res.status >= 200 && res.status < 300) return false;
  return (
    isInkaiAuthFailure(res, data) ||
    res.status === 503 ||
    res.status >= 500
  );
}

export function shouldHardFailInkaiMutation(
  res: { status: number },
  data?: Record<string, unknown> | null,
): boolean {
  if (res.status >= 200 && res.status < 300) return false;
  return !shouldApplyInkaiPrismaFallback(res, data);
}

/** Deteksi gagal auth JWT Inkai (401/pesan token). */
export function isInkaiAuthFailure(
  res: { status: number },
  data?: Record<string, unknown> | null,
): boolean {
  if (res.status === 401) return true;
  const raw =
    (typeof data?.message === "string" && data.message) ||
    (typeof data?.error === "string" && data.error) ||
    "";
  const tokenish = /expired|invalid.*token|token.*invalid|unauthorized/i.test(
    raw,
  );
  if (res.status === 403) {
    // 403 kadang "akses wilayah" — hanya anggap auth bila pesan token.
    return tokenish;
  }
  return tokenish;
}

/** Ubah pesan validasi teknis Inkai/Zod jadi lebih mudah dibaca. */
function friendlyInkaiValidationMessage(raw: string): string {
  const text = raw.trim();
  const lower = text.toLowerCase();

  if (
    lower.includes("invalid or expired token") ||
    lower.includes("jwt expired") ||
    lower.includes("token expired") ||
    lower.includes("expired token") ||
    (lower.includes("unauthorized") && lower.includes("token")) ||
    /^invalid token$/i.test(text) ||
    /token.*(invalid|expired)/i.test(text)
  ) {
    return "Sesi API berakhir. Silakan refresh halaman atau login ulang, lalu coba lagi.";
  }

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

export type InkaiFetchWithServiceRetryResult = InkaiFetchResult & {
  /** True when the successful (or final) call used the service token. */
  usedServiceToken: boolean;
  /** True when user JWT was skipped/retried due to auth/near-expiry. */
  degradedAuth: boolean;
};

/**
 * Admin mutations: prefer service token when user JWT near expiry;
 * on Inkai auth failure retry once with service token.
 * Callers must map errors with portalStatusFromInkai (never forward 401).
 */
export async function inkaiFetchWithServiceRetry(
  path: string,
  init: RequestInit = {},
  userToken?: string | null,
  options: InkaiFetchOptions = {},
): Promise<InkaiFetchWithServiceRetryResult> {
  const service = inkaiServiceToken();
  const preferService =
    Boolean(service) &&
    service !== userToken &&
    shouldPreferServiceToken(userToken);

  if (preferService && service) {
    const result = await inkaiFetch(path, init, service, {
      ...options,
      retries: options.retries ?? 1,
    });
    if (result.res.ok || !isInkaiAuthFailure(result.res, result.data)) {
      if (!result.res.ok) {
        console.warn(
          `[inkaiFetchWithServiceRetry] degraded service-first ${path} status=${result.res.status}`,
        );
      }
      return { ...result, usedServiceToken: true, degradedAuth: true };
    }
    console.warn(
      `[inkaiFetchWithServiceRetry] service-first auth failed ${path}; falling back to user token`,
    );
  }

  const primaryToken = userToken?.trim() || service || null;
  const first = await inkaiFetch(path, init, primaryToken, {
    ...options,
    retries: options.retries ?? 1,
  });

  if (
    first.res.ok ||
    !isInkaiAuthFailure(first.res, first.data) ||
    !service ||
    service === primaryToken
  ) {
    return {
      ...first,
      usedServiceToken: primaryToken === service && Boolean(service),
      degradedAuth: false,
    };
  }

  console.warn(
    `[inkaiFetchWithServiceRetry] user auth failed ${path}; retrying with service token`,
  );
  const retry = await inkaiFetch(path, init, service, {
    ...options,
    retries: options.retries ?? 1,
  });
  return {
    ...retry,
    usedServiceToken: true,
    degradedAuth: true,
  };
}

/** JSON error for admin routes after Inkai failure (never HTTP 401). */
export function inkaiPortalErrorResponse(
  data: Record<string, unknown>,
  fallback: string,
  inkaiStatus: number,
) {
  const status = portalStatusFromInkai(inkaiStatus);
  return NextResponse.json(
    { error: inkaiErrorMessage(data, fallback) },
    { status },
  );
}
