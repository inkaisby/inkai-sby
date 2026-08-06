import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export function parseLoginIdentifier(
  raw: string
): { type: "email"; value: string } | { type: "nia"; values: string[] } {
  const trimmed = raw.trim();
  if (trimmed.includes("@")) {
    return { type: "email", value: trimmed.toLowerCase() };
  }

  const compact = trimmed.replace(/\s+/g, "");
  const variants = new Set<string>();
  if (compact) variants.add(compact);

  const noDots = compact.replace(/\./g, "");
  if (noDots && noDots !== compact) variants.add(noDots);

  const values = Array.from(variants);
  return { type: "nia", values: values.length ? values : ["__impossible_nia__"] };
}

export function userWhereForLoginIdentifier(
  parsed: ReturnType<typeof parseLoginIdentifier>
): Prisma.UserWhereInput {
  if (parsed.type === "email") {
    return { email: { equals: parsed.value, mode: "insensitive" } };
  }

  return {
    OR: parsed.values.map((v) => ({
      member: { nia: { equals: v, mode: "insensitive" }, isDeleted: false },
    })),
  };
}

/**
 * Canonical identifier for Inkai login: email as-is, or stored Member.nia when
 * the typed value matches a known NIA (with/without dots).
 */
export async function resolveLoginIdentifier(raw: string): Promise<string> {
  const parsed = parseLoginIdentifier(raw);
  if (parsed.type === "email") return parsed.value;

  const primary = parsed.values[0] || raw.trim();
  try {
    const member = await prisma.member.findFirst({
      where: {
        isDeleted: false,
        OR: parsed.values.map((v) => ({
          nia: { equals: v, mode: "insensitive" as const },
        })),
      },
      select: { nia: true },
    });
    if (member?.nia?.trim()) return member.nia.trim();
  } catch {
    // fall through to typed value
  }
  return primary;
}
