const WIB = "Asia/Jakarta";

/** Tanggal + jam daftar (WIB) untuk kolom tabel. Kosong → "—". */
export function formatRegisteredAtWib(
  iso: string | null | undefined,
): string {
  if (!iso?.trim()) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const datePart = new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: WIB,
  }).format(d);
  const timePart = new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: WIB,
  }).format(d);
  return `${datePart}, ${timePart.replace(":", ".")}`;
}
