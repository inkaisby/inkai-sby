import { auth } from "@/auth";
import { getInkaiTokenFromCookies } from "@/lib/inkai-api/cookies";

export async function getInkaiAccessToken(): Promise<string | null> {
  const fromCookie = await getInkaiTokenFromCookies();
  if (fromCookie) return fromCookie;

  const session = await auth();
  return session?.accessToken ?? null;
}
