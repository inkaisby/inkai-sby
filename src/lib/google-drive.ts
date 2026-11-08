/**
 * Helper untuk ekstraksi dan download file dari Google Drive.
 */

export function extractGoogleDriveFileId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();

  // Jika langsung berupa ID file Google Drive
  if (/^[a-zA-Z0-9_-]{25,50}$/.test(trimmed)) {
    return trimmed;
  }

  // Format: https://drive.google.com/file/d/FILE_ID/view...
  const matchFileD = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (matchFileD?.[1]) return matchFileD[1];

  // Format: https://drive.google.com/open?id=FILE_ID
  const matchOpenId = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (matchOpenId?.[1]) return matchOpenId[1];

  // Format: https://docs.google.com/.../d/FILE_ID/...
  const matchDocsD = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (matchDocsD?.[1]) return matchDocsD[1];

  return null;
}

export function getGoogleDriveDownloadUrls(fileId: string): string[] {
  return [
    `https://lh3.googleusercontent.com/d/${fileId}`,
    `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`,
    `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`,
  ];
}

/**
 * Deteksi MIME type langsung dari magic bytes file header.
 * Mendukung JPEG, PNG, WEBP, dan PDF.
 */
export function sniffDocumentMimeType(
  buffer: ArrayBuffer,
): { mime: string; ext: string } | null {
  const bytes = new Uint8Array(buffer.slice(0, 16));
  if (bytes.length < 3) return null;

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: "image/jpeg", ext: "jpg" };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { mime: "image/png", ext: "png" };
  }

  // WEBP: RIFF....WEBP
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { mime: "image/webp", ext: "webp" };
  }

  // PDF: %PDF-
  if (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  ) {
    return { mime: "application/pdf", ext: "pdf" };
  }

  return null;
}
