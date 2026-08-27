import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import LoginPageClient from "@/app/(public)/login/LoginPageClient";
import { safeCallbackUrl } from "@/lib/auth/safe-callback-url";
import {
  hasAuthjsSessionCookie,
  hasInkaiTokenCookie,
} from "@/lib/auth/session-cookie";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import { INKAI_TOKEN_COOKIE } from "@/lib/inkai-api/cookies";
import {
  isInkaiTokenSoftValid,
  shouldAutoEnterPortal,
} from "@/lib/inkai-api/auth-gateway";
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

  const inkaiToken = token?.trim() || null;
  const softValid = isInkaiTokenSoftValid(inkaiToken);

  // Stale JWT in cookie — clear so we do not bounce Auth.js session → /admin.
  if (hasTokenCookie && inkaiToken && !softValid) {
    try {
      const jar = await cookies();
      jar.delete(INKAI_TOKEN_COOKIE);
    } catch (err) {
      console.warn("[login] failed to clear stale inkai_token", err);
    }
  }

  if (
    session?.user &&
    shouldAutoEnterPortal({ hasSession: true, inkaiToken })
  ) {
    // Stay on daftar tab even if already signed in (rare dual-tab case).
    if (tab === "daftar") {
      return <LoginPageClient />;
    }
    const destination =
      callbackUrl ??
      resolvePostLoginPath(session.user.roles ?? [], session.user.memberId);
    redirect(destination);
  }

  // Auth.js cookie present but Inkai token missing/expired — ask to sign in again.
  return (
    <LoginPageClient
      sessionExpiredHint={Boolean(session) || hasSessionCookie}
    />
  );
}
