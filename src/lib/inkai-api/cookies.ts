import "server-only";
import { cookies } from "next/headers";

export const INKAI_TOKEN_COOKIE = "inkai_token";

export async function getInkaiTokenFromCookies(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(INKAI_TOKEN_COOKIE)?.value ?? null;
}

/** Align with Auth.js JWT session default (~30 days). Backend JWT may expire sooner. */
export const INKAI_TOKEN_MAX_AGE_SEC = 60 * 60 * 24 * 30;

export function getInkaiTokenCookieOptions(maxAge = INKAI_TOKEN_MAX_AGE_SEC) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}
