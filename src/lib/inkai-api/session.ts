import { cache } from "react";
import { auth } from "@/auth";
import { getInkaiTokenFromCookies } from "@/lib/inkai-api/cookies";

async function getInkaiAccessTokenUncached(): Promise<string | null> {
  const fromCookie = await getInkaiTokenFromCookies();
  if (fromCookie) return fromCookie;

  const session = await auth();
  return session?.accessToken ?? null;
}

/** Dedup per request (layout + page dashboard/admin). */
export const getInkaiAccessToken = cache(getInkaiAccessTokenUncached);
