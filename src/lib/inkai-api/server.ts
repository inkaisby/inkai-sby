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
};

export async function inkaiFetch(
  path: string,
  init: RequestInit = {},
  token?: string | null,
  options: InkaiFetchOptions = {},
): Promise<InkaiFetchResult> {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? INKAI_FETCH_TIMEOUT_MS;
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
  } finally {
    clearTimeout(timeout);
  }
}

export function inkaiErrorMessage(data: Record<string, unknown>, fallback: string) {
  if (typeof data.message === "string") return data.message;
  if (typeof data.error === "string") return data.error;
  return fallback;
}
