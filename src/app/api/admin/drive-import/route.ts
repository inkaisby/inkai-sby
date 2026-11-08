import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { canEditPengurus, getPrimaryAdminRole } from "@/lib/rbac";
import { uploadAdminFile, UploadValidationError } from "@/lib/upload";
import { extractGoogleDriveFileId, getGoogleDriveDownloadUrls } from "@/lib/google-drive";
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
    let detectedType = "application/octet-stream";
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

        const contentType = res.headers.get("content-type") || "";
        // Jika Google Drive mengembalikan HTML (misal halaman peringatan virus scan atau form login)
        if (contentType.includes("text/html")) {
          const htmlText = await res.text();
          // Coba cari token konfirmasi unduhan Google Drive jika file besar
          const confirmMatch = htmlText.match(/confirm=([0-9a-zA-Z_-]+)/);
          if (confirmMatch?.[1]) {
            const confirmUrl = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=${confirmMatch[1]}`;
            const retryRes = await fetch(confirmUrl);
            if (retryRes.ok && !retryRes.headers.get("content-type")?.includes("text/html")) {
              downloadedBuffer = await retryRes.arrayBuffer();
              detectedType = retryRes.headers.get("content-type") || detectedType;
              break;
            }
          }
          continue;
        }

        downloadedBuffer = await res.arrayBuffer();
        detectedType = contentType || detectedType;
        break;
      } catch (err) {
        fetchError = err instanceof Error ? err.message : "Fetch gagal";
      }
    }

    if (!downloadedBuffer || downloadedBuffer.byteLength === 0) {
      return NextResponse.json(
        {
          error:
            "Gagal mengunduh file dari Google Drive. Pastikan opsi berbagi file disetel ke 'Siapa saja yang memiliki link' (Viewer/Publik). " +
            (fetchError ? `(${fetchError})` : ""),
        },
        { status: 400 },
      );
    }

    // Tentukan ekstensi file
    let ext = "bin";
    if (detectedType.includes("jpeg") || detectedType.includes("jpg")) ext = "jpg";
    else if (detectedType.includes("png")) ext = "png";
    else if (detectedType.includes("webp")) ext = "webp";
    else if (detectedType.includes("pdf")) ext = "pdf";

    const fileName = `gdrive-${fileId.slice(0, 10)}-${Date.now()}.${ext}`;
    const file = new File([downloadedBuffer], fileName, { type: detectedType });

    const uploadResult = await uploadAdminFile(file, folder);

    return NextResponse.json({
      success: true,
      url: uploadResult.url,
      pathname: uploadResult.pathname,
      size: downloadedBuffer.byteLength,
      mimeType: detectedType,
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

