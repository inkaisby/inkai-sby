import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

export const ARTICLE_REACTION_EMOJIS = ["👍", "❤️", "🔥", "🙏", "😮"] as const;
export type ArticleReactionEmoji = (typeof ARTICLE_REACTION_EMOJIS)[number];

export const ARTICLE_VISITOR_COOKIE = "inkai_artikel_vid";
const VISITOR_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export type ArticleReactionCounts = Record<ArticleReactionEmoji, number>;

export function emptyReactionCounts(): ArticleReactionCounts {
  return {
    "👍": 0,
    "❤️": 0,
    "🔥": 0,
    "🙏": 0,
    "😮": 0,
  };
}

export function isArticleReactionEmoji(
  value: string,
): value is ArticleReactionEmoji {
  return (ARTICLE_REACTION_EMOJIS as readonly string[]).includes(value);
}

export function attachVisitorCookie(
  response: NextResponse,
  visitorId: string,
) {
  response.cookies.set(ARTICLE_VISITOR_COOKIE, visitorId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: VISITOR_MAX_AGE,
  });
}

/** Read existing visitor cookie or create a new UUID (caller must set cookie). */
export async function resolveArticleVisitorId(): Promise<{
  visitorId: string;
  isNew: boolean;
}> {
  const jar = await cookies();
  const existing = jar.get(ARTICLE_VISITOR_COOKIE)?.value?.trim();
  if (existing && /^[0-9a-f-]{36}$/i.test(existing)) {
    return { visitorId: existing, isNew: false };
  }
  return { visitorId: randomUUID(), isNew: true };
}
