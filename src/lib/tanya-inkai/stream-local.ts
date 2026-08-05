import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
} from "ai";

/** Stream jawaban teks lokal agar kompatibel dengan useChat / UIMessage protocol. */
export function streamLocalTextResponse(text: string): Response {
  const id = generateId();
  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      writer.write({ type: "text-start", id });
      // Kirim per kata agar terasa streaming tanpa LLM
      const parts = text.split(/(\s+)/);
      for (const part of parts) {
        if (!part) continue;
        writer.write({ type: "text-delta", id, delta: part });
      }
      writer.write({ type: "text-end", id });
    },
    onError: () =>
      "Gagal menjawab sementara. Coba lagi sebentar, atau hubungi sekretariat via WhatsApp.",
  });

  return createUIMessageStreamResponse({ stream });
}
