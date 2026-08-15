import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import {
  ARTICLE_VISITOR_COOKIE,
  ARTICLE_VISITOR_MAX_AGE,
} from "@/lib/article-reactions";

export function attachVisitorCookie(
  response: NextResponse,
  visitorId: string,
) {
  response.cookies.set(ARTICLE_VISITOR_COOKIE, visitorId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ARTICLE_VISITOR_MAX_AGE,
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
