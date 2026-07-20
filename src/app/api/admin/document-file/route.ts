import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { isAllowedMemberDocumentUrl } from "@/lib/document-url";

export const maxDuration = 30;

/** Proxy dokumen anggota (same-origin) untuk pratinjau + print di modal. */
export async function GET(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  const raw = new URL(request.url).searchParams.get("url")?.trim() || "";
  if (!raw || !isAllowedMemberDocumentUrl(raw)) {
    return NextResponse.json(
      { error: "URL dokumen tidak valid" },
      { status: 400 },
    );
  }

  try {
    const upstream = await fetch(raw, {
      cache: "no-store",
      headers: { Accept: "*/*" },
    });
    if (!upstream.ok) {
      return NextResponse.json(
        { error: "Gagal mengambil dokumen" },
        { status: upstream.status === 404 ? 404 : 502 },
      );
    }

    const upstreamType =
      upstream.headers.get("content-type") || "application/octet-stream";
    const contentType =
      upstreamType.includes("pdf") || /\.pdf(\?|$)/i.test(raw)
        ? "application/pdf"
        : upstreamType;
    const contentLength = upstream.headers.get("content-length");
    const headers = new Headers({
      "Content-Type": contentType,
      "Content-Disposition": "inline",
      "Cache-Control": "private, max-age=60",
      "X-Content-Type-Options": "nosniff",
    });
    if (contentLength) headers.set("Content-Length", contentLength);

    return new NextResponse(upstream.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("[document-file]", error);
    return NextResponse.json(
      { error: "Gagal mengambil dokumen" },
      { status: 502 },
    );
  }
}
