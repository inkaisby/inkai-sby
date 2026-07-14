import type { Prisma } from "@prisma/client";

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
