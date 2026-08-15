/** Parse scan payload: URL /v/id, path, NIA, or UUID. Aman untuk client & server. */
export function parseMemberCardScanPayload(raw: string): string {
  const q = raw.trim();
  if (!q) return "";
  try {
    if (q.includes("/v/")) {
      const u = q.startsWith("http") ? new URL(q) : new URL(q, "https://local");
      const parts = u.pathname.split("/").filter(Boolean);
      const idx = parts.indexOf("v");
      if (idx >= 0 && parts[idx + 1]) return decodeURIComponent(parts[idx + 1]);
    }
  } catch {
    /* fall through */
  }
  const m = q.match(/\/v\/([^/?#]+)/i);
  if (m?.[1]) return decodeURIComponent(m[1]);
  return q;
}
