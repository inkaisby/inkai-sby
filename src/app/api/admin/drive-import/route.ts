import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { canEditPengurus, getPrimaryAdminRole } from "@/lib/rbac";
import { uploadAdminFile, UploadValidationError } from "@/lib/upload";
import {
  extractGoogleDriveFileId,
  getGoogleDriveDownloadUrls,
  sniffDocumentMimeType,
} from "@/lib/google-drive";
import { rateLimitAsync, rateLimitResponse } from "@/lib/security/rate-limit";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) return authResult.error;

    const role = getPrimaryAdminRole(authResult.user.roles);
    const canUpload =
      canEditPengurus(authResult.user.roles) ||
      role === "ADMIN_DOJO" ||
      role === "ADMIN_BRANCH";

    if (!canUpload) {
      return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
    }

    const rlKey = `admin-drive-import:${authResult.user.id}`;
    const limit = await rateLimitAsync(rlKey, { max: 20, windowMs: 60_000 });
    if (!limit.success) {
      return rateLimitResponse(limit.retryAfterSec ?? 60, rlKey);
    }

    const body = await request.json().catch(() => null);
    const driveUrl = String(body?.driveUrl || "").trim();
    const folder = String(body?.folder || "members/documents");

    if (!driveUrl) {
      return NextResponse.json(
        { error: "Tautan Google Drive wajib diisi." },
        { status: 400 },
      );
    }

    const fileId = extractGoogleDriveFileId(driveUrl);
    if (!fileId) {
      return NextResponse.json(
        {
          error:
            "Format tautan Google Drive tidak valid. Gunakan format 'https://drive.google.com/file/d/.../view' atau masukkan File ID.",
        },
        { status: 400 },
      );
    }

    const candidateUrls = getGoogleDriveDownloadUrls(fileId);
    let downloadedBuffer: ArrayBuffer | null = null;
    let detectedMeta: { mime: string; ext: string } | null = null;
    let fetchError: string | null = null;

    for (const url of candidateUrls) {
      try {
        const res = await fetch(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
        });

        if (!res.ok) continue;

        const buf = await res.arrayBuffer();
        if (!buf || buf.byteLength === 0) continue;

        // Sniff MIME type langsung dari magic bytes header file
        const sniffed = sniffDocumentMimeType(buf);
        if (sniffed) {
          downloadedBuffer = buf;
          detectedMeta = sniffed;
          break;
        }

        // Jika bukan gambar/PDF langsung, cek apakah respons adalah HTML konfirmasi Google Drive
        const textSample = new TextDecoder("utf-8").decode(buf.slice(0, 5000));
        if (textSample.includes("<html") || textSample.includes("<!DOCTYPE")) {
          // Cari token konfirmasi unduhan Google Drive (untuk file besar / virus warning)
          const confirmMatch = textSample.match(/confirm=([0-9a-zA-Z_-]+)/);
          if (confirmMatch?.[1]) {
            const confirmUrl = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=${confirmMatch[1]}`;
            const retryRes = await fetch(confirmUrl);
            if (retryRes.ok) {
              const retryBuf = await retryRes.arrayBuffer();
              const retrySniffed = sniffDocumentMimeType(retryBuf);
              if (retrySniffed) {
                downloadedBuffer = retryBuf;
                detectedMeta = retrySniffed;
                break;
              }
            }
          }
        }
      } catch (err) {
        fetchError = err instanceof Error ? err.message : "Fetch gagal";
      }
    }

    if (!downloadedBuffer || !detectedMeta) {
      return NextResponse.json(
        {
          error:
            "Format berkas dari Google Drive tidak dikenali sebagai gambar (JPG/PNG/WebP) atau PDF. " +
            "Pastikan opsi berbagi Google Drive disetel ke 'Siapa saja yang memiliki link' (Viewer), berkas bukan dokumen teks kosong/folder, dan format file adalah gambar atau PDF. " +
            (fetchError ? `(${fetchError})` : ""),
        },
        { status: 400 },
      );
    }

    const fileName = `gdrive-${fileId.slice(0, 10)}-${Date.now()}.${detectedMeta.ext}`;
    const file = new File([downloadedBuffer], fileName, { type: detectedMeta.mime });

    const uploadResult = await uploadAdminFile(file, folder);

    return NextResponse.json({
      success: true,
      url: uploadResult.url,
      pathname: uploadResult.pathname,
      size: downloadedBuffer.byteLength,
      mimeType: detectedMeta.mime,
    });
  } catch (err) {
    if (err instanceof UploadValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[drive-import] Error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Terjadi kesalahan saat memproses file Google Drive.",
      },
      { status: 500 },
    );
  }
}
