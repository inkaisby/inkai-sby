/** Host penyimpanan dokumen anggota yang diizinkan di-proxy (anti-SSRF). */
export function isAllowedMemberDocumentUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    return (
      host.endsWith(".blob.vercel-storage.com") ||
      host.endsWith(".public.blob.vercel-storage.com") ||
      host.endsWith(".supabase.co") ||
      host.endsWith(".supabase.in") ||
      host === "inkai-ecosystem.vercel.app"
    );
  } catch {
    return false;
  }
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toLocaleString("id-ID", {
      maximumFractionDigits: 1,
    })} KB`;
  }
  return `${(bytes / (1024 * 1024)).toLocaleString("id-ID", {
    maximumFractionDigits: 2,
  })} MB`;
}

export function documentProxyUrl(
  sourceUrl: string,
  scope: "admin" | "member" = "admin",
): string {
  const base =
    scope === "member"
      ? "/api/member/document-file"
      : "/api/admin/document-file";
  return `${base}?url=${encodeURIComponent(sourceUrl)}`;
}
