import { NextResponse } from "next/server";
import { executeCodingPrompt, handleBotCommand } from "@/lib/telegram/agent";
import {
  sendTelegramChatAction,
  sendTelegramMessage,
  type TelegramUpdate,
} from "@/lib/telegram/bot";
import { getTelegramConfig, isUserAuthorized } from "@/lib/telegram/config";

export const maxDuration = 60;

export async function GET() {
  const config = getTelegramConfig();
  return NextResponse.json({
    status: "ok",
    service: "inkai-sby telegram coding bot",
    hasBotToken: Boolean(config.botToken),
    hasGithubToken: Boolean(config.githubToken),
    hasAiKey: Boolean(config.aiApiKey),
    allowedUsersCount: config.allowedUserIds.length,
    branch: config.githubBranch,
  });
}

export async function POST(request: Request) {
  try {
    const config = getTelegramConfig();

    // 1. Verifikasi Secret Token Telegram jika diset
    if (config.webhookSecret) {
      const headerSecret = request.headers.get("x-telegram-bot-api-secret-token");
      if (headerSecret !== config.webhookSecret) {
        return NextResponse.json({ error: "Unauthorized webhook secret" }, { status: 403 });
      }
    }

    const body = (await request.json()) as TelegramUpdate;
    const msg = body.message || body.edited_message;

    if (!msg || !msg.text) {
      return NextResponse.json({ ok: true });
    }

    const chatId = msg.chat.id;
    const fromId = msg.from?.id;
    const text = msg.text.trim();

    // 2. Cek Otorisasi Pengguna (Hanya ID yang diizinkan yang boleh mengeksekusi)
    if (!fromId || !isUserAuthorized(fromId)) {
      await sendTelegramMessage(
        chatId,
        `⛔ *Akses Ditolak*

ID Telegram Anda: \`${fromId}\`
Akun: *${msg.from?.first_name || ""} ${msg.from?.last_name || ""}* (@${msg.from?.username || "no-username"})

🔒 Untuk keamanan repository INKAI Surabaya, bot coding ini diproteksi.
Silakan daftarkan ID Anda ke Environment Variables Vercel:
\`TELEGRAM_ALLOWED_USER_IDS=${fromId}\`

Setelah itu, redeploy atau restart project di Vercel.`,
        { parse_mode: "Markdown" },
      );
      return NextResponse.json({ ok: true });
    }

    // 3. Command: /id
    if (text === "/id") {
      await sendTelegramMessage(
        chatId,
        `🆔 *Informasi Akun Telegram Anda:*
• User ID: \`${fromId}\`
• Chat ID: \`${chatId}\`
• Status: *Terverifikasi & Diizinkan* ✅`,
        { parse_mode: "Markdown" },
      );
      return NextResponse.json({ ok: true });
    }

    // 4. Command: /start atau /help
    if (text === "/start" || text === "/help") {
      const helpText = `🥋 *INKAI Surabaya — AI Coding Assistant via HP*

Selamat datang! Anda bisa mengedit kode website INKAI Surabaya langsung dari HP melalui bot ini. Setiap commit akan otomatis di-build & deploy oleh Vercel.

📌 *Daftar Perintah:*
• \`/status\` — Cek commit terakhir di branch \`main\`
• \`/list [nama_folder]\` — Lihat daftar file di repository
• \`/view <path_file>\` — Baca isi file di GitHub
• \`/id\` — Cek ID Telegram Anda
• \`/help\` — Menampilkan panduan ini

🚀 *Cara Melakukan Coding / Ubah Fitur:*
Cukup ketik instruksi yang Anda inginkan (bisa diawali \`/code\` atau teks biasa):

*Contoh Prompt:*
1. \`Ubah judul hero section di src/app/page.tsx menjadi "Pusat Pelatihan Karate Surabaya"\`
2. \`Ganti background navbar di src/components/layout/PublicHeader.tsx jadi warna hitam pekat\`
3. \`Tambahkan tulisan kontak WA di footer\`

Bot akan membaca file, menulis kode baru, membuat commit ke GitHub, lalu Vercel otomatis deploy web live! ✨`;

      await sendTelegramMessage(chatId, helpText, { parse_mode: "Markdown" });
      return NextResponse.json({ ok: true });
    }

    // 5. Command khusus: /status, /list, /view
    const parts = text.split(" ");
    const command = parts[0].toLowerCase();
    const args = parts.slice(1).join(" ");

    if (["/status", "/list", "/view"].includes(command)) {
      await sendTelegramChatAction(chatId, "typing");
      const reply = await handleBotCommand(command, args);
      await sendTelegramMessage(chatId, reply, { parse_mode: "Markdown" });
      return NextResponse.json({ ok: true });
    }

    // 6. Eksekusi Prompt Coding (bisa dengan awalan /code atau ketik langsung)
    const promptToRun = command === "/code" ? args : text;
    if (!promptToRun) {
      await sendTelegramMessage(chatId, "⚠️ Masukkan instruksi coding yang ingin dijalankan.");
      return NextResponse.json({ ok: true });
    }

    // Kirim notifikasi pertama agar user tahu bot sedang bekerja
    await sendTelegramChatAction(chatId, "typing");
    await sendTelegramMessage(
      chatId,
      `⏳ *Sedang menganalisis instruksi & memeriksa repository...*\n\n_"${promptToRun.slice(0, 150)}${promptToRun.length > 150 ? "..." : ""}"_`,
      { parse_mode: "Markdown" },
    );

    // Jalankan autonomous agent
    const result = await executeCodingPrompt(promptToRun);

    // Kirim hasil akhir ke Telegram
    await sendTelegramMessage(chatId, result.replyText, { parse_mode: "Markdown" });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("[telegram-webhook] Error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
