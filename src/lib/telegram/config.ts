/**
 * Konfigurasi modul Telegram Coding Bot.
 * Membaca environment variables untuk Telegram, GitHub API, dan AI Engine.
 */

export interface TelegramConfig {
  botToken: string;
  allowedUserIds: string[];
  webhookSecret?: string;
  githubToken: string;
  githubOwner: string;
  githubRepo: string;
  githubBranch: string;
  aiApiKey: string;
  aiBaseUrl?: string;
  aiModel?: string;
}

export function getTelegramConfig(): TelegramConfig {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim() || "";
  const allowedUserIdsRaw = process.env.TELEGRAM_ALLOWED_USER_IDS?.trim() || "";
  const allowedUserIds = allowedUserIdsRaw
    ? allowedUserIdsRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const githubToken =
    process.env.GITHUB_TOKEN?.trim() ||
    process.env.GH_TOKEN?.trim() ||
    "";
  const githubOwner = process.env.GITHUB_REPO_OWNER?.trim() || "inkaisby";
  const githubRepo = process.env.GITHUB_REPO_NAME?.trim() || "inkai-sby";
  const githubBranch = process.env.GITHUB_BRANCH?.trim() || "main";

  let aiApiKey = "";
  let aiBaseUrl: string | undefined = undefined;
  let aiModel: string | undefined = undefined;

  if (process.env.GEMINI_API_KEY?.trim()) {
    aiApiKey = process.env.GEMINI_API_KEY.trim();
    aiBaseUrl = "https://generativelanguage.googleapis.com/v1beta/openai/";
    aiModel = process.env.TELEGRAM_AI_MODEL?.trim() || "gemini-2.5-flash";
  } else if (process.env.MIXROUTE_API_KEY?.trim()) {
    aiApiKey = process.env.MIXROUTE_API_KEY.trim();
    aiBaseUrl = process.env.AI_BASE_URL?.trim() || "https://api.mixroute.ai/v1";
    aiModel =
      process.env.TELEGRAM_AI_MODEL?.trim() ||
      process.env.TANYA_INKAI_MODEL?.trim() ||
      "gpt-4o-mini";
  } else if (process.env.OPENAI_API_KEY?.trim()) {
    aiApiKey = process.env.OPENAI_API_KEY.trim();
    aiBaseUrl = "https://api.openai.com/v1";
    aiModel = process.env.TELEGRAM_AI_MODEL?.trim() || "gpt-4o-mini";
  } else if (process.env.GROQ_API_KEY?.trim()) {
    aiApiKey = process.env.GROQ_API_KEY.trim();
    aiBaseUrl = "https://api.groq.com/openai/v1";
    aiModel = process.env.TELEGRAM_AI_MODEL?.trim() || "llama-3.3-70b-versatile";
  }

  return {
    botToken,
    allowedUserIds,
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || undefined,
    githubToken,
    githubOwner,
    githubRepo,
    githubBranch,
    aiApiKey,
    aiBaseUrl,
    aiModel,
  };
}

export function isUserAuthorized(userId: number | string): boolean {
  const config = getTelegramConfig();
  const idStr = String(userId);
  // Jika belum ada ID yang didaftarkan, return false demi keamanan
  if (config.allowedUserIds.length === 0) {
    return false;
  }
  return config.allowedUserIds.includes(idStr);
}
