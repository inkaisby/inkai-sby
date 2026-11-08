import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import {
  createMixrouteProvider,
  getTanyaInkaiModelId,
  hasMixrouteApiKey,
} from "@/lib/tanya-inkai/mixroute";
import { generateText } from "ai";
import { rateLimitAsync, rateLimitResponse } from "@/lib/security/rate-limit";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) return authResult.error;

    const rlKey = `ocr-bpjs:${authResult.user.id}`;
    const limit = await rateLimitAsync(rlKey, { max: 30, windowMs: 60_000 });
    if (!limit.success) {
      return rateLimitResponse(limit.retryAfterSec ?? 60, rlKey);
    }

    if (!hasMixrouteApiKey()) {
      return NextResponse.json(
        {
          success: false,
          error: "Layanan AI OCR belum terkonfigurasi (MIXROUTE_API_KEY).",
        },
        { status: 503 },
      );
    }

    let imageBuffer: Buffer | null = null;
    let mimeType = "image/jpeg";

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (file instanceof File) {
        const arrayBuf = await file.arrayBuffer();
        imageBuffer = Buffer.from(arrayBuf);
        mimeType = file.type || "image/jpeg";
      }
    } else {
      const body = await request.json().catch(() => null);
      const fileUrl = String(body?.fileUrl || "").trim();

      if (fileUrl) {
        const res = await fetch(fileUrl);
        if (!res.ok) {
          return NextResponse.json(
            { success: false, error: "Gagal mengambil file BPJS dari URL." },
            { status: 400 },
          );
        }
        const arrayBuf = await res.arrayBuffer();
        imageBuffer = Buffer.from(arrayBuf);
        mimeType = res.headers.get("content-type") || "image/jpeg";
      }
    }

    if (!imageBuffer || imageBuffer.length === 0) {
      return NextResponse.json(
        { success: false, error: "File gambar BPJS wajib dikirim." },
        { status: 400 },
      );
    }

    // Jika file adalah PDF, kita tidak dapat langsung mengumpankannya ke vision model biasa
    if (mimeType.includes("pdf")) {
      return NextResponse.json({
        success: false,
        error: "OCR otomatis saat ini mendukung format gambar (JPEG, PNG, WebP). Untuk PDF silakan masukkan nomor BPJS manual.",
      });
    }

    const base64Data = imageBuffer.toString("base64");
    const dataUrl = `data:${mimeType};base64,${base64Data}`;

    const provider = createMixrouteProvider();
    const model = provider(getTanyaInkaiModelId());

    const result = await generateText({
      model,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Kamu adalah asisten OCR dokumen resmi Indonesia. Baca gambar kartu BPJS ini dan ekstrak NOMOR KARTU BPJS (13 digit angka, biasanya berawalan 000...). Kembalikan HANYA 13 digit nomor kartu tersebut tanpa spasi, tanda baca, atau kata-kata pembuka/penjelas lainnya. Jika tidak terbaca, kembalikan 'NOT_FOUND'.",
            },
            {
              type: "image",
              image: dataUrl,
            },
          ],
        },
      ],
    });

    const raw = (result.text || "").trim();
    if (raw === "NOT_FOUND" || !raw) {
      return NextResponse.json({
        success: false,
        error: "Nomor kartu BPJS tidak terdeteksi pada gambar.",
      });
    }

    // Cari pola 13 digit angka (dengan atau tanpa 000 di awal)
    const digitsOnly = raw.replace(/\D/g, "");
    const match = digitsOnly.match(/(000\d{10}|\d{13})/);

    if (match?.[0]) {
      return NextResponse.json({
        success: true,
        bpjsNumber: match[0],
      });
    }

    // Jika hasil raw sendiri adalah 13 digit angka
    if (/^\d{13}$/.test(digitsOnly)) {
      return NextResponse.json({
        success: true,
        bpjsNumber: digitsOnly,
      });
    }

    return NextResponse.json({
      success: false,
      rawOutput: raw,
      error: "Nomor kartu BPJS 13 digit tidak ditemukan pada gambar.",
    });
  } catch (err) {
    console.error("[ocr-bpjs] Error:", err);
    return NextResponse.json(
      {
        success: false,
        error:
          err instanceof Error
            ? err.message
            : "Terjadi kesalahan saat memproses OCR BPJS.",
      },
      { status: 500 },
    );
  }
}

