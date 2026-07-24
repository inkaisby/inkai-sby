import { put } from "@vercel/blob";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

/** Thrown for user-facing validation issues — safe to echo to the client. */
export class UploadValidationError extends Error {}

type SignatureCheck = { mime: string; check: (bytes: Uint8Array) => boolean };

const SIGNATURES: SignatureCheck[] = [
  {
    mime: "image/jpeg",
    check: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    mime: "image/png",
    check: (b) =>
      b.length >= 8 &&
      b[0] === 0x89 &&
      b[1] === 0x50 &&
      b[2] === 0x4e &&
      b[3] === 0x47 &&
      b[4] === 0x0d &&
      b[5] === 0x0a &&
      b[6] === 0x1a &&
      b[7] === 0x0a,
  },
  {
    mime: "image/webp",
    check: (b) =>
      b.length >= 12 &&
      b[0] === 0x52 && // R
      b[1] === 0x49 && // I
      b[2] === 0x46 && // F
      b[3] === 0x46 && // F
      b[8] === 0x57 && // W
      b[9] === 0x45 && // E
      b[10] === 0x42 && // B
      b[11] === 0x50, // P
  },
  {
    mime: "image/gif",
    check: (b) =>
      b.length >= 6 &&
      b[0] === 0x47 && // G
      b[1] === 0x49 && // I
      b[2] === 0x46 && // F
      b[3] === 0x38 && // 8
      (b[4] === 0x37 || b[4] === 0x39) && // 7 or 9
      b[5] === 0x61, // a
  },
  {
    mime: "application/pdf",
    check: (b) =>
      b.length >= 5 &&
      b[0] === 0x25 && // %
      b[1] === 0x50 && // P
      b[2] === 0x44 && // D
      b[3] === 0x46 && // F
      b[4] === 0x2d, // -
  },
];

/** Sniff the real file type from its magic bytes; null if unrecognized. */
function detectMimeFromBytes(bytes: Uint8Array): string | null {
  return SIGNATURES.find((sig) => sig.check(bytes))?.mime ?? null;
}

export async function assertUploadableFile(file: File) {
  if (!ALLOWED.has(file.type)) {
    throw new UploadValidationError("Format file tidak didukung (gambar atau PDF)");
  }
  if (file.size > MAX_BYTES) {
    throw new UploadValidationError("Ukuran file maksimal 8 MB");
  }

  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const detected = detectMimeFromBytes(header);
  if (!detected || detected !== file.type) {
    throw new UploadValidationError(
      "Isi file tidak sesuai format yang diklaim (gagal verifikasi header file)",
    );
  }
}

export function isBlobUploadConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

/** Only allow safe folder segments under inkai-sby/. */
export function sanitizeUploadFolder(folder: string | undefined | null): string {
  const raw = (folder || "pengurus").trim().toLowerCase();
  const cleaned = raw
    .replace(/\\/g, "/")
    .split("/")
    .map((seg) => seg.replace(/[^a-z0-9_-]/g, "").slice(0, 32))
    .filter((seg) => seg.length > 0 && seg !== "." && seg !== "..")
    .slice(0, 4)
    .join("/");
  return cleaned || "pengurus";
}

export async function uploadAdminFile(
  file: File,
  folder = "pengurus",
): Promise<{ url: string; pathname: string }> {
  await assertUploadableFile(file);

  if (!isBlobUploadConfigured()) {
    throw new UploadValidationError(
      "Upload belum dikonfigurasi. Set BLOB_READ_WRITE_TOKEN di environment, atau tempel URL manual.",
    );
  }

  const safeFolder = sanitizeUploadFolder(folder);
  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(0, 80);
  const key = `inkai-sby/${safeFolder}/${Date.now()}-${safeName}`;

  // Public Blob for QR/carousel compatibility; folder is sanitized against path traversal.
  const blob = await put(key, file, {
    access: "public",
    token: process.env.BLOB_READ_WRITE_TOKEN,
    contentType: file.type,
  });

  return { url: blob.url, pathname: blob.pathname };
}

/** Alias generik (admin & anggota). */
export const uploadPublicFile = uploadAdminFile;
