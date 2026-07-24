import tutorials from "../../guide/member-tutorials.json";

export type MemberTutorialSection = {
  id: string;
  title: string;
  summary: string;
  steps: string[];
  youtubeUrl?: string;
};

export type MemberTutorialsJson = {
  version: string;
  title: string;
  subtitle?: string;
  sections: MemberTutorialSection[];
};

export const MEMBER_TUTORIALS = tutorials as MemberTutorialsJson;

/** Convert watch/youtu.be URL to embed URL, or null if empty/invalid. */
export function youtubeEmbedSrc(url: string | undefined | null): string | null {
  const raw = url?.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (host === "youtube.com" || host === "m.youtube.com") {
      if (u.pathname.startsWith("/embed/")) {
        const id = u.pathname.split("/")[2];
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }
      const v = u.searchParams.get("v");
      return v ? `https://www.youtube.com/embed/${v}` : null;
    }
  } catch {
    return null;
  }
  return null;
}

export function getMemberTutorials(): MemberTutorialsJson {
  return MEMBER_TUTORIALS;
}
