/** Target ukuran dokumen anggota setelah kompresi (150 KB). */
export const DOCUMENT_COMPRESS_MAX_BYTES = 150 * 1024;

const MAX_EDGE_PX = 1600;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Gagal membaca gambar"));
    };
    img.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

function drawScaled(
  img: HTMLImageElement,
  maxEdge: number,
): HTMLCanvasElement {
  const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas tidak tersedia");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return canvas;
}

/**
 * Kompres gambar ke JPEG mendekati `maxBytes` (default 150 KB).
 * PDF: lolos jika sudah ≤ maxBytes; jika lebih besar → error (minta foto/scan).
 */
export async function compressUploadFile(
  file: File,
  maxBytes = DOCUMENT_COMPRESS_MAX_BYTES,
): Promise<File> {
  if (file.type === "application/pdf") {
    if (file.size <= maxBytes) return file;
    throw new Error(
      `PDF lebih dari ${Math.round(maxBytes / 1024)} KB. Unggah foto/scan dokumen sebagai JPG/PNG (otomatis dikompres).`,
    );
  }

  if (!file.type.startsWith("image/")) {
    return file;
  }

  // Sudah cukup kecil — tetap konversi ke JPEG agar konsisten.
  const img = await loadImage(file);
  let maxEdge = MAX_EDGE_PX;
  let best: Blob | null = null;

  for (let attempt = 0; attempt < 6; attempt++) {
    const canvas = drawScaled(img, maxEdge);
    let lo = 0.35;
    let hi = 0.92;
    let localBest: Blob | null = null;

    for (let i = 0; i < 8; i++) {
      const q = (lo + hi) / 2;
      const blob = await canvasToBlob(canvas, "image/jpeg", q);
      if (!blob) break;
      if (blob.size <= maxBytes) {
        localBest = blob;
        lo = q + 0.02;
      } else {
        hi = q - 0.02;
      }
      if (hi < lo) break;
    }

    // Fallback: quality terendah pada ukuran ini
    if (!localBest) {
      localBest = await canvasToBlob(canvas, "image/jpeg", 0.35);
    }

    if (localBest && (!best || localBest.size < best.size)) {
      best = localBest;
    }

    if (best && best.size <= maxBytes) break;
    maxEdge = Math.round(maxEdge * 0.75);
    if (maxEdge < 480) break;
  }

  if (!best) {
    throw new Error("Gagal mengompres gambar");
  }

  if (best.size > maxBytes) {
    throw new Error(
      `Tidak bisa mengecilkan ke ${Math.round(maxBytes / 1024)} KB. Coba foto lebih sederhana atau crop dulu.`,
    );
  }

  const base = file.name.replace(/\.[^.]+$/, "") || "dokumen";
  const name = `${base.replace(/[^\w.\-]+/g, "_").slice(0, 60)}.jpg`;
  return new File([best], name, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}
