import { ImageResponse } from "next/og";
import {
  formatArticleDate,
  getArticleBySlug,
} from "@/lib/articles";

export const runtime = "nodejs";
export const revalidate = 60;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type Props = { params: Promise<{ slug: string }> };

export default async function ArticleOgImage({ params }: Props) {
  const { slug } = await params;
  const item = await getArticleBySlug(slug);
  const title = item?.title ?? "Artikel INKAI Surabaya";
  const dateLabel = item ? formatArticleDate(item.publishedAt) : null;
  const photoUrl = item?.photoUrl ?? null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: photoUrl
            ? "#111"
            : "linear-gradient(135deg, #b91c1c 0%, #7f1d1d 45%, #ca8a04 100%)",
          color: "#fff",
          fontFamily: "sans-serif",
        }}
      >
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl}
            alt=""
            width={1200}
            height={630}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        ) : null}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: photoUrl
              ? "linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.78) 100%)"
              : "linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.45) 100%)",
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
            padding: "48px 56px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://inkai-sby.vercel.app/logo-inkai.png"
              alt="INKAI"
              width={72}
              height={72}
              style={{
                width: 72,
                height: 72,
                borderRadius: 999,
                background: "#fff",
                objectFit: "contain",
              }}
            />
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                fontSize: 22,
                opacity: 0.92,
              }}
            >
              <span>INKAI Cabang Surabaya</span>
              <span style={{ fontSize: 18, opacity: 0.8 }}>Artikel</span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {dateLabel ? (
              <span style={{ fontSize: 24, opacity: 0.85 }}>{dateLabel}</span>
            ) : null}
            <span
              style={{
                fontSize: title.length > 60 ? 48 : 58,
                fontWeight: 800,
                lineHeight: 1.15,
                maxWidth: 1040,
              }}
            >
              {title.length > 110 ? `${title.slice(0, 107)}…` : title}
            </span>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
