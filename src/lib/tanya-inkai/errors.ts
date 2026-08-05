const GENERIC_EN =
  /^(an error occurred\.?|failed to fetch|network error|fetch failed|internal server error\.?)$/i;

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
  const msg = raw.toLowerCase();

  if (
    !process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
    /api key|api_key|unauthorized|401|permission denied|invalid.*key/.test(msg)
  ) {
    return "Layanan Tanya INKAI belum dikonfigurasi (kunci Gemini). Hubungi pengurus atau coba lagi nanti.";
  }

  if (
    /429|rate limit|quota|resource Exhausted|resource_exhausted|too many requests/.test(
      msg,
    )
  ) {
    return "Batas kuota AI gratis sementara tercapai. Tunggu sebentar lalu coba lagi, atau hubungi sekretariat via WhatsApp.";
  }

  if (/timeout|timed out|deadline/.test(msg)) {
    return "Respons AI terlalu lama. Coba kirim lagi sebentar.";
  }

  if (GENERIC_EN.test(raw.trim()) || !raw.trim()) {
    return "Gagal menjawab sementara. Coba lagi sebentar, atau hubungi sekretariat via WhatsApp.";
  }

  // Jangan teruskan pesan Inggris mentah dari SDK bila terlihat generik/teknis
  if (/gateway|credit card|vercel|stack|exception|etypeerror/i.test(msg)) {
    return "Gagal memproses Tanya INKAI. Coba lagi sebentar, atau hubungi sekretariat via WhatsApp.";
  }

  return "Gagal menjawab sementara. Coba lagi sebentar, atau hubungi sekretariat via WhatsApp.";
}

export function friendlyClientErrorMessage(message: string | undefined): string {
  if (!message?.trim() || GENERIC_EN.test(message.trim())) {
    return "Gagal menjawab sementara. Coba lagi sebentar, atau hubungi sekretariat via WhatsApp.";
  }
  // Jika API sudah mengirim BI, tampilkan apa adanya
  if (/tanya inkai|kuota|gemini|whatsapp|sekretariat|konfigurasi/i.test(message)) {
    return message;
  }
  return mapTanyaInkaiError(new Error(message));
}
