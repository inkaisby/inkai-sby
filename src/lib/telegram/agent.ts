import { askAi } from "./ai";
import {
  commitMultipleFiles,
  getFileContent,
  getLatestCommit,
  listRepositoryFiles,
} from "./github";

export interface AgentResult {
  replyText: string;
  filesModified?: string[];
  commitUrl?: string;
  sha?: string;
}

/**
 * Memproses instruksi coding dari Telegram.
 */
export async function executeCodingPrompt(userPrompt: string): Promise<AgentResult> {
  // 1. Ambil daftar file di repo GitHub
  const allFiles = await listRepositoryFiles();
  if (allFiles.length === 0) {
    return {
      replyText:
        "⚠️ Tidak dapat membaca file repository dari GitHub. Pastikan GITHUB_TOKEN memiliki hak akses `repo` dan terkonfigurasi dengan benar di Vercel.",
    };
  }

  // 2. Minta AI menentukan file mana yang perlu dibaca dan diubah berdasarkan prompt
  const fileFinderSystem = `Anda adalah asisten arsitektur Next.js.
Diberikan daftar file dalam repository inkai-sby dan instruksi user.
Tugas Anda adalah memilih maksimal 3 file yang paling relevan untuk diubah.

Kembalikan HANYA format JSON tanpa markdown:
{
  "targetFiles": ["path/to/file1.tsx"]
}`;

  let targetFiles: string[] = [];
  try {
    const rawChoice = await askAi({
      system: fileFinderSystem,
      prompt: `Daftar file repository:\n${allFiles.slice(0, 300).join("\n")}\n\nInstruksi user: "${userPrompt}"`,
      temperature: 0.1,
      maxTokens: 500,
    });

    const cleanedChoice = rawChoice.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleanedChoice);
    if (Array.isArray(parsed.targetFiles)) {
      targetFiles = parsed.targetFiles.filter((p: string) => allFiles.includes(p));
    }
  } catch {
    // Fallback: cari kata kunci file di user prompt
    targetFiles = allFiles
      .filter((p) => {
        const base = p.split("/").pop()?.toLowerCase();
        return base && userPrompt.toLowerCase().includes(base);
      })
      .slice(0, 2);
  }

  if (targetFiles.length === 0) {
    return {
      replyText:
        "⚠️ AI tidak dapat menemukan file yang sesuai dengan instruksi Anda di repository. Coba sebutkan nama file atau foldernya secara spesifik (misal: `src/components/layout/PublicHeader.tsx`).",
    };
  }

  // 3. Baca isi file yang akan diubah
  const fileContexts: Array<{ path: string; content: string }> = [];
  for (const filePath of targetFiles) {
    const fetched = await getFileContent(filePath);
    if (fetched) {
      fileContexts.push({ path: filePath, content: fetched.content });
    }
  }

  if (fileContexts.length === 0) {
    return {
      replyText: `⚠️ Gagal membaca konten file: ${targetFiles.join(", ")} dari GitHub.`,
    };
  }

  // 4. Minta AI memodifikasi file sesuai instruksi
  const coderSystem = `Anda adalah Software Engineer ahli Next.js 16 (App Router), React 19, TypeScript, dan Tailwind CSS.
Anda bertugas memodifikasi file pada proyek web INKAI Surabaya sesuai instruksi user.

ATURAN WAJIB:
1. Pertahankan import, struktur type, dan penamaan yang sudah ada.
2. Jangan merusak logika bisnis yang tidak diminta untuk diubah.
3. Seluruh isi file yang diubah harus LENGKAP dari baris pertama sampai terakhir (JANGAN pakai placeholder "...kode sebelumnya...").
4. Berikan format respon HANYA JSON murni (tanpa tag \`\`\`json):
{
  "commitMessage": "Pesan commit ringkas (contoh: update warna hero navbar)",
  "summary": "Ringkasan perubahan dalam 1-2 kalimat bahasa Indonesia",
  "files": [
    {
      "path": "path/ke/file",
      "content": "isi kode lengkap baru"
    }
  ]
}`;

  const promptBody = `Instruksi User:
${userPrompt}

Berikut adalah isi file saat ini:
${fileContexts
  .map((f) => `=== FILE: ${f.path} ===\n${f.content}\n=== END FILE ===`)
  .join("\n\n")}`;

  let generatedText: string;
  try {
    generatedText = await askAi({
      system: coderSystem,
      prompt: promptBody,
      temperature: 0.2,
      maxTokens: 4000,
    });
  } catch (err) {
    return {
      replyText: `⚠️ Terjadi kesalahan saat memanggil AI: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // 5. Parse hasil JSON dari AI
  interface CodeResponse {
    commitMessage: string;
    summary: string;
    files: Array<{ path: string; content: string }>;
  }

  let codeResult: CodeResponse;
  try {
    const jsonStr = generatedText
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();
    codeResult = JSON.parse(jsonStr);
  } catch (err) {
    return {
      replyText: `⚠️ Gagal memparsing respon kode AI menjadi format valid.\nRespon mentah:\n${generatedText.slice(0, 500)}`,
    };
  }

  if (!codeResult.files || codeResult.files.length === 0) {
    return {
      replyText: `ℹ️ AI menganalisis instruksi namun tidak ada perubahan file yang dihasilkan.\nCatatan: ${codeResult.summary || generatedText}`,
    };
  }

  // 6. Commit perubahan ke GitHub
  const commitRes = await commitMultipleFiles({
    files: codeResult.files,
    message: `${codeResult.commitMessage || "Update via Telegram Bot"} [skip ci]`,
  });

  if (!commitRes.ok) {
    return {
      replyText: `❌ Gagal melakukan commit ke GitHub: ${commitRes.error}`,
    };
  }

  const modifiedList = codeResult.files.map((f) => `• \`${f.path}\``).join("\n");
  const reply = `✅ *Perubahan Berhasil Di-Commit ke GitHub!*

📝 *Pesan Commit:* ${codeResult.commitMessage}
📁 *File yang Diubah:*
${modifiedList}

ℹ️ *Ringkasan:*
${codeResult.summary}

🔗 *Commit:* [Lihat di GitHub](${commitRes.commitUrl})
🚀 *Status Vercel:* Sedang otomatis rebuild & deploy! Perubahan akan live di web dalam 1–2 menit.`;

  return {
    replyText: reply,
    filesModified: codeResult.files.map((f) => f.path),
    commitUrl: commitRes.commitUrl,
    sha: commitRes.sha,
  };
}

/**
 * Menghandle perintah khusus bot (seperti /status, /view, /list).
 */
export async function handleBotCommand(command: string, args: string): Promise<string> {
  const cmd = command.toLowerCase();

  if (cmd === "/status") {
    const latest = await getLatestCommit();
    if (!latest) {
      return "⚠️ Tidak dapat mengambil status commit terbaru. Pastikan GITHUB_TOKEN sudah diset.";
    }
    return `📊 *Status Proyek INKAI Surabaya*

🌿 *Branch:* \`main\`
📌 *Commit Terakhir:* \`${latest.sha}\`
👤 *Author:* ${latest.author}
📅 *Waktu:* ${latest.date}
📝 *Pesan:* ${latest.message}

🔗 [Lihat Commit di GitHub](${latest.url})
🌐 *Website Live:* [inkai-sby.vercel.app](https://inkai-sby.vercel.app)`;
  }

  if (cmd === "/list") {
    const all = await listRepositoryFiles();
    if (all.length === 0) return "⚠️ Gagal membaca daftar file repository.";

    const filterDir = args.trim().toLowerCase();
    const filtered = filterDir
      ? all.filter((f) => f.toLowerCase().includes(filterDir))
      : all.slice(0, 50);

    const title = filterDir
      ? `📁 *File dengan kata kunci "${filterDir}":* (${filtered.length} file)`
      : `📁 *Daftar File (50 file pertama):*`;

    return `${title}\n\n${filtered.map((f) => `\`${f}\``).join("\n")}${
      !filterDir && all.length > 50 ? `\n\n_...dan ${all.length - 50} file lainnya._` : ""
    }`;
  }

  if (cmd === "/view") {
    const target = args.trim();
    if (!target) {
      return "⚠️ Masukkan path file yang ingin dibaca. Contoh: `/view src/components/layout/PublicHeader.tsx`";
    }
    const file = await getFileContent(target);
    if (!file) {
      return `⚠️ File \`${target}\` tidak ditemukan atau tidak dapat dibaca dari GitHub.`;
    }

    const lines = file.content.split("\n");
    const preview = lines.slice(0, 70).join("\n");
    const truncatedNotice =
      lines.length > 70 ? `\n\n_... (ditampilkan 70 dari ${lines.length} baris)_` : "";

    return `📄 *File:* \`${file.path}\` (${lines.length} baris)\n\n\`\`\`tsx\n${preview}\n\`\`\`${truncatedNotice}`;
  }

  return "";
}
