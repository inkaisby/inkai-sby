import { cookies } from "next/headers";

export const INKAI_TOKEN_COOKIE = "inkai_token";

export async function getInkaiTokenFromCookies(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(INKAI_TOKEN_COOKIE)?.value ?? null;
}

export function getInkaiTokenCookieOptions(maxAge = 60 * 60 * 24) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}
