import { parseApiJson } from "@/lib/api-client";

export type EventRegistrationKind = "ukt" | "latber";

export function isAlreadyRegisteredError(message: string): boolean {
  return /sudah terdaftar/i.test(message);
}

export type RegisterMemberToEventResult =
  | { ok: true }
  | { ok: false; alreadyRegistered: boolean; error: string };

export async function registerMemberToEvent(
  memberId: string,
  kind: EventRegistrationKind,
  eventId: string,
): Promise<RegisterMemberToEventResult> {
  const url =
    kind === "ukt" ? "/api/admin/ukt/register" : "/api/admin/latber/register";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventId, memberId }),
  });
  const data = await parseApiJson<{ error?: string }>(res);
  if (!res.ok) {
    const msg = data.error || "Gagal mendaftar";
    if (isAlreadyRegisteredError(msg)) {
      return { ok: false, alreadyRegistered: true, error: msg };
    }
    return { ok: false, alreadyRegistered: false, error: msg };
  }
  return { ok: true };
}
