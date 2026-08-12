import { prisma } from "@/lib/prisma";

/** Meta pendaftaran Latber mandiri (AppSetting). */
export type LatberSelfRegistrationMeta = {
  source: "member";
  registeredAt: string;
  memberPaymentConfirmedAt: string | null;
};

export function latberSelfRegistrationKey(
  eventId: string,
  memberId: string,
): string {
  return `latber-self-reg:${eventId}:${memberId}`;
}

export function parseLatberSelfRegistrationMeta(
  value: unknown,
): LatberSelfRegistrationMeta | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (raw.source !== "member") return null;
  return {
    source: "member",
    registeredAt:
      typeof raw.registeredAt === "string"
        ? raw.registeredAt
        : new Date().toISOString(),
    memberPaymentConfirmedAt:
      typeof raw.memberPaymentConfirmedAt === "string"
        ? raw.memberPaymentConfirmedAt
        : null,
  };
}

export async function loadLatberSelfRegistrationMeta(
  eventId: string,
  memberId: string,
): Promise<LatberSelfRegistrationMeta | null> {
  const row = await prisma.appSetting.findUnique({
    where: { key: latberSelfRegistrationKey(eventId, memberId) },
  });
  return parseLatberSelfRegistrationMeta(row?.value);
}

export async function upsertLatberSelfRegistrationMeta(
  eventId: string,
  memberId: string,
  meta: LatberSelfRegistrationMeta,
): Promise<void> {
  const key = latberSelfRegistrationKey(eventId, memberId);
  await prisma.appSetting.upsert({
    where: { key },
    create: { key, value: meta },
    update: { value: meta },
  });
}

export async function deleteLatberSelfRegistrationMeta(
  eventId: string,
  memberId: string,
): Promise<void> {
  try {
    await prisma.appSetting.delete({
      where: { key: latberSelfRegistrationKey(eventId, memberId) },
    });
  } catch {
    /* ignore missing */
  }
}
