import {
  OG_CONTENT_TYPE,
  OG_SIZE,
  renderBrandedOgImage,
} from "@/lib/og-image";

export const runtime = "nodejs";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "INKAI Surabaya — Kontak";

export default function Image() {
  return renderBrandedOgImage({ title: "Kontak" });
}
