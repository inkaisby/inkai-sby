import {
  OG_CONTENT_TYPE,
  OG_SIZE,
  renderBrandedOgImage,
} from "@/lib/og-image";
import { formatLatberPeriodLabel } from "@/lib/latber";
import { getLatberPublicPeriod } from "@/lib/latber-public";

export const runtime = "nodejs";
export const revalidate = 60;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Latihan Bersama — INKAI Surabaya";

function formatOgDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("id-ID", {
    dateStyle: "long",
    timeStyle: "short",
  });
}

export default async function Image() {
  try {
    const period = await getLatberPublicPeriod();
    const periodLabel = period.title
      ? formatLatberPeriodLabel(period.title)
      : null;
    const title = periodLabel
      ? `Latihan Bersama — ${periodLabel}`
      : "Latihan Bersama";
    const parts = [
      formatOgDate(period.eventAt),
      period.eventLocation?.trim() || null,
    ].filter(Boolean);
    return renderBrandedOgImage({
      title,
      eyebrow: "INKAI Cabang Surabaya",
      subtitle: parts.length > 0 ? parts.join(" · ") : "Pendaftaran terbuka",
    });
  } catch {
    return renderBrandedOgImage({
      title: "Latihan Bersama",
      eyebrow: "INKAI Cabang Surabaya",
      subtitle: "Pendaftaran anggota ranting",
    });
  }
}
