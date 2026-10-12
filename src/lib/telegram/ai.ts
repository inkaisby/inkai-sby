import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";
import { getTelegramConfig } from "./config";

/**
 * Mendapatkan model AI berdasarkan konfigurasi environment yang tersedia.
 * Mendukung Gemini, Mixroute, OpenAI, dan model OpenAI-compatible lainnya.
 */
export function getAiModel() {
  const config = getTelegramConfig();

  if (!config.aiApiKey) {
    throw new Error(
      "API Key AI belum diset. Atur GEMINI_API_KEY, MIXROUTE_API_KEY, atau OPENAI_API_KEY di environment variables Vercel.",
    );
  }

  const provider = createOpenAICompatible({
    name: "telegram-ai-coder",
    baseURL: config.aiBaseUrl || "https://api.mixroute.ai/v1",
    apiKey: config.aiApiKey,
  });

  const modelName = config.aiModel || "gpt-4o-mini";
  return provider(modelName);
}

/**
 * Memanggil AI dengan prompt teks.
 */
export async function askAi(params: {
  system: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  const model = getAiModel();

  const { text } = await generateText({
    model,
    system: params.system,
    prompt: params.prompt,
    temperature: params.temperature ?? 0.2,
    maxOutputTokens: params.maxTokens ?? 4000,
  });

  return text.trim();
}
