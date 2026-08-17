"use client";

import { showError } from "@/lib/client-toast";
import {
  isUnauthorizedPayload,
  SESSION_EXPIRED_MESSAGE,
} from "@/lib/session-expired";

/** Toast error API admin; 401 → pesan ID + ke /login. */
export function showAdminFetchError(
  res: Response,
  data: { error?: string },
  fallback: string,
) {
  if (isUnauthorizedPayload(res.status, data.error)) {
    showError(SESSION_EXPIRED_MESSAGE);
    window.location.assign("/login");
    return;
  }
  showError(data.error || fallback);
}
