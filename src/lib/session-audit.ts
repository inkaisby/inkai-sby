import { headers } from "next/headers";
import { getClientIp } from "@/lib/security/request";
import {
  buildLocationLabel,
  countryCodeToName,
  parseUserAgent,
  type ClientAuditMeta,
  type SessionAuditSnapshot,
} from "@/lib/session-audit-parse";

export type { ClientAuditMeta, SessionAuditSnapshot } from "@/lib/session-audit-parse";
export {
  parseUserAgent,
  buildLocationLabel,
  countryCodeToName,
  deviceSummary,
} from "@/lib/session-audit-parse";

/** Ambil jejak audit dari Request (API route). */
export function snapshotFromRequest(
  request: Request,
  client?: ClientAuditMeta | null,
): SessionAuditSnapshot {
  const ipRaw = getClientIp(request);
  const ip = !ipRaw || ipRaw === "unknown" ? null : ipRaw;
  const userAgent = request.headers.get("user-agent");
  const parsed = parseUserAgent(userAgent);

  const city =
    request.headers.get("x-vercel-ip-city") ||
    request.headers.get("cf-ipcity") ||
    null;
  const region =
    request.headers.get("x-vercel-ip-country-region") ||
    request.headers.get("cf-region") ||
    null;
  const countryCode =
    request.headers.get("x-vercel-ip-country") ||
    request.headers.get("cf-ipcountry") ||
    null;
  const country = countryCodeToName(countryCode);

  const timezone = client?.timezone?.trim() || null;
  const language =
    client?.language?.trim() ||
    request.headers.get("accept-language")?.split(",")[0]?.trim() ||
    null;
  const screen = client?.screen?.trim() || null;
  const platform = client?.platform?.trim() || null;

  const locationLabel =
    buildLocationLabel({ city, region, country }) ||
    (timezone ? `Zona ${timezone}` : null);

  return {
    ip,
    userAgent,
    deviceType: parsed.deviceType,
    browser: parsed.browser,
    os: parsed.os,
    city,
    region,
    country,
    locationLabel,
    timezone,
    language,
    screen,
    platform,
  };
}

/** Ambil jejak dari next/headers (authorize NextAuth). */
export async function snapshotFromNextHeaders(
  client?: ClientAuditMeta | null,
): Promise<SessionAuditSnapshot> {
  const h = await headers();
  const fake = new Request("http://localhost", { headers: h });
  return snapshotFromRequest(fake, client);
}
