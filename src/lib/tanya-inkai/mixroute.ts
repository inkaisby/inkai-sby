import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

const DEFAULT_BASE = "https://api.mixroute.ai/v1";
const DEFAULT_MODEL = "gpt-4o-mini";

export function getMixrouteApiKey(): string {
  return process.env.MIXROUTE_API_KEY?.trim() || "";
}

export function hasMixrouteApiKey(): boolean {
  return Boolean(getMixrouteApiKey());
}

export function getMixrouteBaseUrl(): string {
  return (
    process.env.AI_BASE_URL?.trim() ||
    process.env.MIXROUTE_BASE_URL?.trim() ||
    DEFAULT_BASE
  );
}

/** Model id MixRoute (bukan slug Gateway google/...). */
export function getTanyaInkaiModelId(): string {
  const raw =
    process.env.TANYA_INKAI_MODEL?.trim() ||
    process.env.MODEL_ROUTER?.trim() ||
    DEFAULT_MODEL;
  return raw.replace(/^google\//i, "");
}

export function createMixrouteProvider() {
  return createOpenAICompatible({
    name: "mixroute",
    apiKey: getMixrouteApiKey() || "missing-key",
    baseURL: getMixrouteBaseUrl(),
  });
}
