/**
 * Ambil nomor utama dari field telepon yang mungkin multi-nomor
 * (mis. "0852…/0896…" atau dipisah koma/titik koma).
 */
export function primaryPhoneRaw(phone: string | null | undefined): string {
  const raw = String(phone || "").trim();
  if (!raw) return "";
  const first =
    raw.split(/\s*[/|,;|&]\s*|\s+atau\s+/i)[0]?.trim() ?? raw;
  return first;
}

/** Digit saja dari nomor utama (tanpa normalisasi negara). */
export function primaryPhoneDigits(phone: string | null | undefined): string {
  return primaryPhoneRaw(phone).replace(/\D/g, "");
}

/**
 * Normalisasi ke format wa.me (62…).
 * Multi-nomor: hanya segmen pertama yang dipakai.
 */
export function toWhatsAppDigits(phone: string | null | undefined): string {
  let digits = primaryPhoneDigits(phone);
  if (!digits) return "";
  if (digits.startsWith("0")) digits = `62${digits.slice(1)}`;
  else if (!digits.startsWith("62") && digits.length >= 9) {
    digits = `62${digits}`;
  }
  // Guard bila data kotor tanpa pemisah: potong ke panjang wajar nomor Indo
  if (digits.startsWith("62") && digits.length > 15) {
    digits = digits.slice(0, 13);
  }
  return digits;
}

export function toWhatsAppLink(
  phone: string | null | undefined,
  fallbackDigits?: string,
): string {
  const digits = toWhatsAppDigits(phone) || String(fallbackDigits || "").replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : "https://wa.me/";
}
