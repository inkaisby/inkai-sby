import { getMemberTutorials } from "@/lib/memberTutorials";
import { buildOrgKnowledgeBlock } from "@/lib/tanya-inkai/org-knowledge";
import { SITE_CONTACT } from "@/lib/site";
import { toWhatsAppLink } from "@/lib/phone";

type Chunk = {
  id: string;
  title: string;
  href: string;
  text: string;
  tokens: string[];
};

const STOP = new Set([
  "yang",
  "dan",
  "atau",
  "untuk",
  "dari",
  "dengan",
  "pada",
  "ini",
  "itu",
  "di",
  "ke",
  "cara",
  "bagaimana",
  "apa",
  "apakah",
  "tolong",
  "mohon",
  "saya",
  "aku",
  "the",
  "a",
  "an",
  "of",
  "to",
  "is",
  "ada",
]);

const OFF_TOPIC =
  /\b(cuaca|weather|bitcoin|crypto|coding|javascript|python|politik|presiden|film|lagu|resep|mata pelajaran|pr\b|pekerjaan rumah)\b/i;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

function buildChunks(): Chunk[] {
  const tutorials = getMemberTutorials();
  const chunks: Chunk[] = tutorials.sections.map((section) => {
    const body = `${section.title}\n${section.summary}\n${section.steps.join("\n")}`;
    return {
      id: `tutorial-${section.id}`,
      title: section.title,
      href: "/tutorial",
      text: body,
      tokens: tokenize(body),
    };
  });

  const org = buildOrgKnowledgeBlock();
  const sections = org.split(/^## /m).filter(Boolean);
  for (const section of sections) {
    const lines = section.trim().split("\n");
    const titleLine = lines[0] || "Organisasi";
    const hrefMatch = titleLine.match(/\/[a-z0-9\-]+/);
    const href = hrefMatch?.[0] || "/";
    const text = section.trim();
    chunks.push({
      id: `org-${titleLine.slice(0, 32)}`,
      title: titleLine.replace(/\s*\(halaman.*$/, "").trim(),
      href,
      text,
      tokens: tokenize(text),
    });
  }

  chunks.push({
    id: "kontak",
    title: "Kontak sekretariat",
    href: "/kontak",
    text: `Kontak INKAI Surabaya ${SITE_CONTACT.address} ${SITE_CONTACT.phone} ${SITE_CONTACT.email} ${SITE_CONTACT.hours}`,
    tokens: tokenize(
      `kontak alamat telepon email whatsapp jam ${SITE_CONTACT.address} ${SITE_CONTACT.phone}`,
    ),
  });

  return chunks;
}

let cachedChunks: Chunk[] | null = null;

function getChunks(): Chunk[] {
  if (!cachedChunks) cachedChunks = buildChunks();
  return cachedChunks;
}

function scoreChunk(chunk: Chunk, qTokens: string[]): number {
  if (!qTokens.length) return 0;
  let score = 0;
  const set = new Set(chunk.tokens);
  for (const t of qTokens) {
    if (set.has(t)) score += 2;
    else if (chunk.text.toLowerCase().includes(t)) score += 1;
  }
  // Boost common portal intents
  const title = chunk.title.toLowerCase();
  if (/daftar|pendaftaran|registrasi/.test(qTokens.join(" ")) && /pendaftaran|daftar/.test(title)) {
    score += 4;
  }
  if (/iuran|bayar|setor/.test(qTokens.join(" ")) && /iuran/.test(title)) score += 4;
  if (/ukt|sabuk|kyu|ujian/.test(qTokens.join(" ")) && /ukt/.test(title)) score += 4;
  if (/sejarah/.test(qTokens.join(" ")) && /sejarah/.test(title)) score += 4;
  if (/visi|misi/.test(qTokens.join(" ")) && /visi/.test(title)) score += 4;
  if (/lambang|logo/.test(qTokens.join(" ")) && /lambang/.test(title)) score += 4;
  if (/absen|absensi|hadir/.test(qTokens.join(" ")) && /absensi/.test(title)) score += 4;
  if (/dojo|ranting/.test(qTokens.join(" ")) && /dojo|struktur|kontak/.test(title + chunk.href)) {
    score += 2;
  }
  return score;
}

/**
 * Jawaban FAQ lokal tanpa LLM (mode degraded bila MixRoute belum dikonfigurasi).
 */
export function answerTanyaInkaiLocal(question: string): string {
  const wa = toWhatsAppLink(SITE_CONTACT.whatsapp);
  const q = question.trim();
  if (!q) {
    return "Silakan tulis pertanyaan seputar INKAI Surabaya atau cara memakai website ini.";
  }

  if (OFF_TOPIC.test(q) && !/inkai|karate|ukt|iuran|dojo|ranting|sabuk|anggota/i.test(q)) {
    return [
      "Saya hanya membantu seputar INKAI Surabaya dan penggunaan website ini.",
      "Contoh topik: pendaftaran anggota, login, iuran, UKT, absensi, sejarah, visi-misi, dojo, kontak.",
      `Butuh bantuan manusia? WhatsApp sekretariat: ${wa}`,
    ].join("\n");
  }

  const qTokens = tokenize(q);
  const ranked = getChunks()
    .map((c) => ({ c, score: scoreChunk(c, qTokens) }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  if (!best || best.score < 2) {
    return [
      "Saya belum menemukan panduan yang cocok di situs. Coba tanya tentang:",
      "• Pendaftaran / daftar anggota → /tutorial atau /login?tab=daftar",
      "• Iuran, UKT, absensi → /tutorial",
      "• Sejarah, visi-misi, lambang → /sejarah, /visi-misi, /makna-lambang",
      "• Dojo & kontak → /dojo, /kontak",
      `Atau WhatsApp sekretariat: ${wa}`,
    ].join("\n");
  }

  const excerpt = best.c.text
    .split("\n")
    .filter(Boolean)
    .slice(0, 12)
    .join("\n");

  return [
    `Berdasarkan panduan situs (${best.c.title}):`,
    "",
    excerpt,
    "",
    `Detail: ${best.c.href}`,
    `Bantuan manusia: ${wa}`,
  ].join("\n");
}
