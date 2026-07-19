/** Util notifikasi yang aman diimpor dari Client Components. */

function normalizeName(s: string) {
  return s.trim().toUpperCase().replace(/\s+/g, " ");
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Apakah teks menyebut nama dojo (pola umum: `(DOJO JWON)`). */
export function textMentionsDojo(text: string, dojoName: string): boolean {
  const hay = normalizeName(text);
  const name = normalizeName(dojoName);
  if (!name || name.length < 2) return false;
  if (hay.includes(`(${name})`)) return true;
  if (hay.includes(`(DOJO ${name})`)) return true;
  const bare = name.replace(/^DOJO\s+/, "");
  if (bare.length >= 2 && hay.includes(`(DOJO ${bare})`)) return true;
  if (bare.length >= 2 && hay.includes(`(${bare})`)) return true;
  return new RegExp(`\\b${escapeRegExp(name)}\\b`, "i").test(text);
}

/** Ekstrak label ranting dari teks notifikasi untuk badge UI. */
export function extractDojoLabelFromNotificationText(
  text: string,
): string | null {
  const paren = text.match(/\(([^)]{2,60})\)/);
  if (paren?.[1]) {
    const inner = paren[1].trim();
    if (/dojo|ranting/i.test(inner) || inner === inner.toUpperCase()) {
      return inner;
    }
  }
  return null;
}
