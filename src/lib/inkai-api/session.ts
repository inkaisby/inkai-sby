import { cache } from "react";
import { headers } from "next/headers";
import { getToken } from "next-auth/jwt";
import { getInkaiTokenFromCookies } from "@/lib/inkai-api/cookies";

async function getInkaiAccessTokenUncached(): Promise<string | null> {
  const fromCookie = await getInkaiTokenFromCookies();
  if (fromCookie) return fromCookie;

  // Fallback: Auth.js JWT (server-only). accessToken is never copied to the
  // session callback so /api/auth/session and useSession cannot read it.
  try {
    const hdrs = await headers();
    const jwt = await getToken({
      req: { headers: hdrs },
      secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
    });
    if (typeof jwt?.accessToken === "string" && jwt.accessToken) {
      return jwt.accessToken;
    }
  } catch (error) {
    console.error("[getInkaiAccessToken] jwt fallback failed", error);
  }

  return null;
}

/** Dedup per request (layout + page dashboard/admin). */
export const getInkaiAccessToken = cache(getInkaiAccessTokenUncached);
