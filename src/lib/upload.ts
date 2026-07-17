import { put } from "@vercel/blob";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

export function assertUploadableFile(file: File) {
  if (!ALLOWED.has(file.type)) {
    throw new Error("Format file tidak didukung (gambar atau PDF)");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("Ukuran file maksimal 8 MB");
  }
}

export function isBlobUploadConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

export async function uploadAdminFile(
  file: File,
  folder = "pengurus",
): Promise<{ url: string; pathname: string }> {
  assertUploadableFile(file);

  if (!isBlobUploadConfigured()) {
    throw new Error(
      "Upload belum dikonfigurasi. Set BLOB_READ_WRITE_TOKEN di environment, atau tempel URL manual.",
    );
  }

  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(0, 80);
  const key = `inkai-sby/${folder}/${Date.now()}-${safeName}`;

  const blob = await put(key, file, {
    access: "public",
    token: process.env.BLOB_READ_WRITE_TOKEN,
    contentType: file.type,
  });

  return { url: blob.url, pathname: blob.pathname };
}

/** Alias generik (admin & anggota). */
export const uploadPublicFile = uploadAdminFile;
