/** Extract YouTube video id from watch / youtu.be / embed / shorts URL. */
export function youtubeVideoId(url: string | undefined | null): string | null {
  const raw = url?.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      return id && /^[\w-]{6,}$/.test(id) ? id : null;
    }
    if (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "music.youtube.com" ||
      host === "youtube-nocookie.com"
    ) {
      if (u.pathname.startsWith("/embed/")) {
        const id = u.pathname.split("/")[2];
        return id && /^[\w-]{6,}$/.test(id) ? id : null;
      }
      if (u.pathname.startsWith("/shorts/")) {
        const id = u.pathname.split("/")[2];
        return id && /^[\w-]{6,}$/.test(id) ? id : null;
      }
      const v = u.searchParams.get("v");
      return v && /^[\w-]{6,}$/.test(v) ? v : null;
    }
  } catch {
    return null;
  }
  return null;
}

/** Convert watch/youtu.be URL to privacy-enhanced embed URL, or null. */
export function youtubeEmbedSrc(url: string | undefined | null): string | null {
  const id = youtubeVideoId(url);
  return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
}

/** Max-res thumbnail URL for a YouTube video (or null). */
export function youtubeThumbUrl(url: string | undefined | null): string | null {
  const id = youtubeVideoId(url);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}
