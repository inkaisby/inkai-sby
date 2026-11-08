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
    `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`,
    `https://lh3.googleusercontent.com/d/${fileId}`,
    `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`,
  ];
}

