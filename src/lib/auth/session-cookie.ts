import "server-only";
import { cookies } from "next/headers";
import { INKAI_TOKEN_COOKIE } from "@/lib/inkai-api/cookies";

/** Auth.js session cookie names (dev vs production secure). */
export const AUTHJS_SESSION_COOKIES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
] as const;

export async function hasAuthjsSessionCookie(): Promise<boolean> {
  const jar = await cookies();
  return AUTHJS_SESSION_COOKIES.some((name) => Boolean(jar.get(name)?.value));
}

export async function hasInkaiTokenCookie(): Promise<boolean> {
  const jar = await cookies();
  return Boolean(jar.get(INKAI_TOKEN_COOKIE)?.value);
}
