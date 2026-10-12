import { NextRequest, NextResponse } from "next/server";
import {
  getTelegramWebhookInfo,
  registerTelegramWebhook,
} from "@/lib/telegram/bot";
import { getTelegramConfig } from "@/lib/telegram/config";

/**
 * Endpoint bantuan untuk mengecek konfigurasi dan mendaftarkan URL Webhook ke Telegram.
 * Akses: GET /api/telegram/setup?url=https://inkai-sby.vercel.app/api/telegram/webhook
 */
export async function GET(request: NextRequest) {
  const config = getTelegramConfig();
  const searchParams = request.nextUrl.searchParams;
  const targetUrl = searchParams.get("url");

  // Jika parameter url diberikan, langsung daftarkan webhook ke Telegram
  if (targetUrl) {
    if (!config.botToken) {
      return NextResponse.json(
        { error: "TELEGRAM_BOT_TOKEN belum diset di environment variables" },
        { status: 400 },
      );
    }

    const regResult = await registerTelegramWebhook(targetUrl, config.webhookSecret);
    const info = await getTelegramWebhookInfo();

    return NextResponse.json({
      success: regResult.ok,
      registerResponse: regResult,
      currentWebhookInfo: info,
    });
  }

  // Jika hanya membuka /api/telegram/setup tanpa parameter, tampilkan status & petunjuk
  const webhookInfo = await getTelegramWebhookInfo();

  return NextResponse.json({
    status: "ok",
    checklist: {
      botTokenConfigured: Boolean(config.botToken),
      githubTokenConfigured: Boolean(config.githubToken),
      aiEngineConfigured: Boolean(config.aiApiKey),
      allowedUsersCount: config.allowedUserIds.length,
      allowedUserIds: config.allowedUserIds,
      repository: `${config.githubOwner}/${config.githubRepo} (${config.githubBranch})`,
    },
    currentTelegramWebhookInfo: webhookInfo,
    panduanSetWebhook:
      "Untuk mendaftarkan webhook, buka URL ini di browser atau jalankan GET dengan parameter ?url=:\n" +
      `${request.nextUrl.origin}/api/telegram/setup?url=${request.nextUrl.origin}/api/telegram/webhook`,
  });
}
