import { redirect } from "next/navigation";
import { auth } from "@/auth";
import LoginPageClient from "@/app/(public)/login/LoginPageClient";
import { safeCallbackUrl } from "@/lib/auth/safe-callback-url";
import {
  hasAuthjsSessionCookie,
  hasInkaiTokenCookie,
} from "@/lib/auth/session-cookie";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import { resolvePostLoginPath } from "@/lib/rbac";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstParam(
  value: string | string[] | undefined,
): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value[0]) return value[0];
  return null;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const callbackUrl = safeCallbackUrl(firstParam(params.callbackUrl));
  const tab = firstParam(params.tab);

  // Guest path: skip auth()/claims refresh when no session cookie (login latency).
  const hasSessionCookie = await hasAuthjsSessionCookie();
  if (!hasSessionCookie) {
    return <LoginPageClient />;
  }

  const [session, token, hasTokenCookie] = await Promise.all([
    auth(),
    getInkaiAccessToken(),
    hasInkaiTokenCookie(),
  ]);

  const hasToken = Boolean(token) || hasTokenCookie;

  if (session?.user && hasToken) {
    // Stay on daftar tab even if already signed in (rare dual-tab case).
    if (tab === "daftar") {
      return <LoginPageClient />;
    }
    const destination =
      callbackUrl ??
      resolvePostLoginPath(session.user.roles ?? [], session.user.memberId);
    redirect(destination);
  }

  // Auth.js cookie present but Inkai API token gone — ask to sign in again.
  return <LoginPageClient sessionExpiredHint={Boolean(session) || hasSessionCookie} />;
}
