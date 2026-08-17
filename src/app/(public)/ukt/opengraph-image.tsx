import {
  OG_CONTENT_TYPE,
  OG_SIZE,
  renderBrandedOgImage,
} from "@/lib/og-image";

export const runtime = "nodejs";
export const revalidate = 60;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "UKT — INKAI Surabaya";

export default async function Image() {
  return renderBrandedOgImage({
    title: "Daftar Peserta UKT",
    eyebrow: "INKAI Cabang Surabaya",
    subtitle: "Ujian Kenaikan Tingkat — periode aktif",
  });
}
