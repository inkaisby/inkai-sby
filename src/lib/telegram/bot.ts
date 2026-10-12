import { getTelegramConfig } from "./config";

export interface TelegramUser {
  id: number;
  is_bot?: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface TelegramChat {
  id: number;
  type: string;
  title?: string;
  username?: string;
  first_name?: string;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  reply_to_message?: TelegramMessage;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
}

const TELEGRAM_API_BASE = "https://api.telegram.org";

/**
 * Mengirim pesan balasan ke chat Telegram.
 * Memotong otomatis jika melebihi limit 4096 karakter Telegram.
 */
export async function sendTelegramMessage(
  chatId: number | string,
  text: string,
  options?: {
    parse_mode?: "Markdown" | "HTML";
    reply_to_message_id?: number;
  },
): Promise<{ ok: boolean; message_id?: number; error?: string }> {
  const { botToken } = getTelegramConfig();
  if (!botToken) {
    console.error("[telegram] TELEGRAM_BOT_TOKEN belum diset.");
    return { ok: false, error: "TELEGRAM_BOT_TOKEN belum diset" };
  }

  // Telegram limit 4096 karakter per pesan
  const chunks: string[] = [];
  const maxChunk = 3900;
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxChunk) {
      chunks.push(remaining);
      break;
    }
    let slicePoint = remaining.lastIndexOf("\n", maxChunk);
    if (slicePoint <= 0) {
      slicePoint = maxChunk;
    }
    chunks.push(remaining.substring(0, slicePoint));
    remaining = remaining.substring(slicePoint).trimStart();
  }

  let lastMessageId: number | undefined;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    try {
      const payload: Record<string, unknown> = {
        chat_id: chatId,
        text: chunk,
      };

      if (options?.parse_mode) {
        payload.parse_mode = options.parse_mode;
      }
      if (options?.reply_to_message_id && i === 0) {
        payload.reply_to_message_id = options.reply_to_message_id;
      }

      let res = await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      // Jika format Markdown gagal diparsing oleh Telegram, kirim ulang tanpa parse_mode
      if (!res.ok && options?.parse_mode) {
        delete payload.parse_mode;
        res = await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (data.ok) {
        lastMessageId = data.result?.message_id;
      } else {
        console.error("[telegram] sendMessage error:", data);
        return { ok: false, error: data.description || "Gagal mengirim pesan" };
      }
    } catch (err: unknown) {
      console.error("[telegram] sendMessage exception:", err);
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  return { ok: true, message_id: lastMessageId };
}

/**
 * Mengirim aksi typing agar di HP muncul indikator 'mengetik...'.
 */
export async function sendTelegramChatAction(
  chatId: number | string,
  action: "typing" | "upload_document" = "typing",
): Promise<void> {
  const { botToken } = getTelegramConfig();
  if (!botToken) return;

  try {
    await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/sendChatAction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, action }),
    });
  } catch {
    // Ignore non-fatal action errors
  }
}

/**
 * Mengedit pesan yang sudah terkirim (misal mengubah 'Sedang memproses...' menjadi hasil).
 */
export async function editTelegramMessage(
  chatId: number | string,
  messageId: number,
  text: string,
  options?: { parse_mode?: "Markdown" | "HTML" },
): Promise<boolean> {
  const { botToken } = getTelegramConfig();
  if (!botToken) return false;

  try {
    const payload: Record<string, unknown> = {
      chat_id: chatId,
      message_id: messageId,
      text: text.slice(0, 4000),
    };
    if (options?.parse_mode) {
      payload.parse_mode = options.parse_mode;
    }

    let res = await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/editMessageText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok && options?.parse_mode) {
      delete payload.parse_mode;
      res = await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/editMessageText`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }

    const data = await res.json();
    return Boolean(data.ok);
  } catch {
    return false;
  }
}

/**
 * Registrasi URL Webhook ke Telegram API.
 */
export async function registerTelegramWebhook(
  webhookUrl: string,
  secretToken?: string,
): Promise<{ ok: boolean; description?: string }> {
  const { botToken } = getTelegramConfig();
  if (!botToken) {
    return { ok: false, description: "TELEGRAM_BOT_TOKEN belum diset" };
  }

  const payload: Record<string, unknown> = {
    url: webhookUrl,
    allowed_updates: ["message"],
  };
  if (secretToken) {
    payload.secret_token = secretToken;
  }

  const res = await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return await res.json();
}

/**
 * Ambil status webhook saat ini.
 */
export async function getTelegramWebhookInfo(): Promise<Record<string, unknown>> {
  const { botToken } = getTelegramConfig();
  if (!botToken) return { ok: false, error: "TELEGRAM_BOT_TOKEN tidak ada" };

  try {
    const res = await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/getWebhookInfo`);
    return await res.json();
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
