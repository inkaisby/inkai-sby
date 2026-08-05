const GENERIC_EN =
  /^(an error occurred\.?|failed to fetch|network error|fetch failed|internal server error\.?)$/i;

function extractJsonErrorField(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{") || !trimmed.includes("error")) return null;
  try {
    const parsed = JSON.parse(trimmed) as { error?: unknown };
    if (typeof parsed.error === "string" && parsed.error.trim()) {
      return parsed.error.trim();
    }
  } catch {
    const m = trimmed.match(/"error"\s*:\s*"((?:\\.|[^"\\])*)"/);
    if (m?.[1]) {
      return m[1].replace(/\\"/g, '"').replace(/\\n/g, "\n");
    }
  }
  return null;
}

/**
 * Pesan error ramah Bahasa Indonesia untuk klien / stream onError.
 * Jangan bocorkan stack atau detail internal.
 */
export function mapTanyaInkaiError(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";

  const fromJson = extractJsonErrorField(raw);
  if (fromJson) return fromJson;

  const msg = raw.toLowerCase();

  if (/401|unauthorized|invalid.*key|incorrect.*api|mixroute.*ditolak/.test(msg)) {
    return "Kunci MixRoute ditolak. Periksa MIXROUTE_API_KEY di Vercel lalu redeploy.";
  }

  if (/402|insufficient|balance|billing|payment|saldo|kuota mixroute/.test(msg)) {
    return "Saldo atau kuota MixRoute tidak mencukupi. Top-up di console.mixroute.ai lalu coba lagi.";
  }

  if (
    /429|rate limit|quota|resource_exhausted|too many requests/.test(msg)
  ) {
    return "Batas laju AI tercapai. Tunggu sebentar lalu coba lagi, atau hubungi sekretariat via WhatsApp.";
  }

  if (/404|model.*not.*found|does not exist/.test(msg)) {
    return "Model AI tidak ditemukan di MixRoute. Sesuaikan TANYA_INKAI_MODEL.";
  }

  if (/timeout|timed out|deadline|fetch failed|econnrefused|enotfound|network/.test(msg)) {
    return "Tidak dapat menghubungi layanan AI. Coba lagi sebentar.";
  }

  if (GENERIC_EN.test(raw.trim()) || !raw.trim()) {
    return "Gagal menjawab sementara. Coba lagi sebentar, atau hubungi sekretariat via WhatsApp.";
  }

  if (/gateway|credit card|vercel|stack|exception|etypeerror|gemini/i.test(msg)) {
    return "Gagal memproses Tanya INKAI. Coba lagi sebentar, atau hubungi sekretariat via WhatsApp.";
  }

  return "Gagal menjawab sementara. Coba lagi sebentar, atau hubungi sekretariat via WhatsApp.";
}

export function friendlyClientErrorMessage(message: string | undefined): string {
  if (!message?.trim()) {
    return "Gagal menjawab sementara. Coba lagi sebentar, atau hubungi sekretariat via WhatsApp.";
  }

  const fromJson = extractJsonErrorField(message);
  if (fromJson) return fromJson;

  if (GENERIC_EN.test(message.trim())) {
    return "Gagal menjawab sementara. Coba lagi sebentar, atau hubungi sekretariat via WhatsApp.";
  }

  if (
    /tanya inkai|kuota|mixroute|whatsapp|sekretariat|konfigurasi|kunci/i.test(
      message,
    )
  ) {
    return message;
  }

  return mapTanyaInkaiError(new Error(message));
}
