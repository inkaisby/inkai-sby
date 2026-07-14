import { getInkaiApiBaseUrl } from "@/lib/inkai-api/server";

type AuditParams = {
  userId?: string | null;
  email?: string | null;
  action: string;
  details?: string;
  ip?: string | null;
  userAgent?: string | null;
  token?: string | null;
};

/** Fire-and-forget — never blocks API response. */
export function writeAuditLog(params: AuditParams): void {
  const token = params.token;
  if (!token) return;

  fetch(`${getInkaiApiBaseUrl()}/v1/audit-logs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      action: params.action,
      details: params.details,
      ip: params.ip ?? undefined,
      userAgent: params.userAgent ?? undefined,
    }),
  }).catch(() => {});
}
