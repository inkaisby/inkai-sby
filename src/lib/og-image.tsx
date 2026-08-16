import { ImageResponse } from "next/og";
import { SITE_URL } from "@/lib/site";

export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_CONTENT_TYPE = "image/png";

const LOGO_URL = `${SITE_URL}/logo-inkai.png`;

/**
 * Branded 1200x630 preview card (gradient INKAI + logo + judul).
 * Dipakai konvensi opengraph-image tiap halaman publik agar pratinjau
 * tautan (WhatsApp/Facebook) menampilkan kartu berlabel, bukan logo kecil.
 */
export function renderBrandedOgImage({
  title,
  eyebrow = "INKAI Cabang Surabaya",
  subtitle,
}: {
  title: string;
  eyebrow?: string;
  subtitle?: string;
}) {
  const safeTitle = title.length > 90 ? `${title.slice(0, 87)}…` : title;
  const safeSubtitle =
    subtitle && subtitle.length > 120
      ? `${subtitle.slice(0, 117)}…`
      : subtitle;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background:
            "linear-gradient(135deg, #b91c1c 0%, #7f1d1d 45%, #ca8a04 100%)",
          color: "#fff",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.42) 100%)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            height: "100%",
            padding: "56px 64px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={LOGO_URL}
              alt="INKAI"
              width={80}
              height={80}
              style={{
                width: 80,
                height: 80,
                borderRadius: 999,
                background: "#fff",
                objectFit: "contain",
              }}
            />
            <span style={{ fontSize: 26, fontWeight: 600, opacity: 0.95 }}>
              {eyebrow}
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <span
              style={{
                fontSize: safeTitle.length > 40 ? 64 : 76,
                fontWeight: 800,
                lineHeight: 1.1,
                maxWidth: 1040,
              }}
            >
              {safeTitle}
            </span>
            {safeSubtitle ? (
              <span
                style={{
                  fontSize: 28,
                  fontWeight: 500,
                  opacity: 0.92,
                  maxWidth: 1040,
                  lineHeight: 1.35,
                }}
              >
                {safeSubtitle}
              </span>
            ) : null}
            <span
              style={{
                height: 8,
                width: 140,
                borderRadius: 999,
                background: "#facc15",
                display: "flex",
              }}
            />
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE },
  );
}
