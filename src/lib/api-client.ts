export async function parseApiJson<T extends Record<string, unknown> = Record<string, unknown>>(
  res: Response,
): Promise<T> {
  const text = await res.text();
  if (!text.trim()) {
    return { error: res.ok ? undefined : `Server error (${res.status})` } as unknown as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return { error: "Respons server tidak valid" } as unknown as T;
  }
}
