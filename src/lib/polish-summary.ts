/**
 * Rapikan ringkasan apresiasi (plain text): spasi, paragraf, kapital, frasa kenangan.
 * Deterministik & idempotent — tanpa rewrite diksi.
 */

const INNALILLAHI = "Innalillahi wa inna ilaihi raji'un";

/** Varian umum yang sering typo / tanpa spasi setelah titik. */
const PHRASE_FIXES: Array<{ pattern: RegExp; replacement: string }> = [
  {
    pattern:
      /\b(?:i?n+al+il+ahi|nnalillahi|innalilahi|innalillahi)\s+wa\s+inna\s+ilaihi\s+raji['']?un\b/gi,
    replacement: INNALILLAHI,
  },
  {
    pattern: /\b(?:i?n+al+il+ahi|nnalillahi|innalilahi)\b/gi,
    replacement: "Innalillahi",
  },
];

function capitalizeSentenceStarts(text: string): string {
  return text.replace(/(^|[.!?]\s+|\n\n+)([a-zà-öø-ÿ])/g, (_, prefix, ch) => {
    return prefix + ch.toUpperCase();
  });
}

function tidyInlineSpaces(line: string): string {
  return line
    .replace(/[ \t]+/g, " ")
    .replace(/\s+([,.;:!?)])/g, "$1")
    .replace(/([,.;:!?)])([A-Za-zÀ-ÿ])/g, "$1 $2")
    .replace(/([([{])\s+/g, "$1")
    .trim();
}

/**
 * Rapikan ringkasan apresiasi untuk form admin & penyimpanan server.
 */
export function polishAppreciationSummary(raw: string): string {
  let text = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!text) return "";

  for (const { pattern, replacement } of PHRASE_FIXES) {
    text = text.replace(pattern, replacement);
  }

  // Pecah jadi paragraf (pisah oleh blank line); dalam paragraf, baris tunggal digabung spasi.
  const paragraphs = text
    .split(/\n{2,}/)
    .map((block) =>
      block
        .split("\n")
        .map(tidyInlineSpaces)
        .filter(Boolean)
        .join(" "),
    )
    .map((p) => p.trim())
    .filter(Boolean);

  text = paragraphs.join("\n\n");

  // Spasi setelah tanda baca jika huruf menyusul tanpa spasi: "un.dengan" → "un. Dengan"
  text = text.replace(/([.!?])([A-Za-zÀ-ÿ])/g, "$1 $2");

  text = capitalizeSentenceStarts(text);

  // Pastikan frasa baku tetap kapitalisasi benar setelah capitalize
  text = text.replace(
    /\binnalillahi wa inna ilaihi raji['']?un\b/gi,
    INNALILLAHI,
  );

  return text.trim();
}

export function summaryHintForKind(kind: "KENANGAN" | "PRESTASI"): string {
  if (kind === "KENANGAN") {
    return "Ideal 2–3 paragraf pendek (~400–900 karakter): pembuka duka → peran/warisan → penutup hormat.";
  }
  return "Ideal 1–2 paragraf (~200–500 karakter): capaian + ajang → konteks dojo/tingkat.";
}

export function summaryPlaceholderForKind(
  kind: "KENANGAN" | "PRESTASI",
): string {
  if (kind === "KENANGAN") {
    return "Innalillahi wa inna ilaihi raji'un. Dengan penuh rasa duka cita, kami mengenang…\n\nBeliau dikenang sebagai…\n\nSemoga amal kebaikannya diterima.";
  }
  return "Meraih Juara 1 Kumite pada Kejuaraan…\n\nAtlet dojo … yang membawa nama INKAI Surabaya.";
}

export function titlePlaceholderForKind(kind: "KENANGAN" | "PRESTASI"): string {
  if (kind === "KENANGAN") {
    return "#Obituari | Requiescat in Pace, …";
  }
  return "Juara 1 Kumite -60kg · Kejuaraan …";
}
