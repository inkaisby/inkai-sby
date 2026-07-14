export function getInkaiApiBaseUrl(): string {
  const url =
    process.env.INKAI_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_INKAI_API_URL?.trim() ||
    "";
  if (!url) {
    throw new Error("INKAI_API_URL belum diset di environment.");
  }
  return url.replace(/\/$/, "");
}

export type InkaiFetchResult = {
  res: Response;
  data: Record<string, unknown>;
};

export async function inkaiFetch(
  path: string,
  init: RequestInit = {},
  token?: string | null,
): Promise<InkaiFetchResult> {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${getInkaiApiBaseUrl()}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { res, data };
}

export function inkaiErrorMessage(data: Record<string, unknown>, fallback: string) {
  if (typeof data.message === "string") return data.message;
  if (typeof data.error === "string") return data.error;
  return fallback;
}
