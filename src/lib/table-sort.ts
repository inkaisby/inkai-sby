import type { Prisma } from "@prisma/client";

export type SortDir = "asc" | "desc";

export const MEMBER_SORT_KEYS = [
  "nia",
  "fullName",
  "currentRank",
  "status",
  "dojo",
  "createdAt",
] as const;

export type MemberSortKey = (typeof MEMBER_SORT_KEYS)[number];

export function parseMemberSortKey(raw: string | null | undefined): MemberSortKey {
  if (raw && MEMBER_SORT_KEYS.includes(raw as MemberSortKey)) {
    return raw as MemberSortKey;
  }
  return "fullName";
}

export function parseSortDir(raw: string | null | undefined): SortDir {
  return raw === "desc" ? "desc" : "asc";
}

export function memberOrderBy(
  sort: MemberSortKey,
  dir: SortDir,
): Prisma.MemberOrderByWithRelationInput {
  switch (sort) {
    case "nia":
      return { nia: dir };
    case "currentRank":
      return { currentRank: dir };
    case "status":
      return { status: dir };
    case "dojo":
      return { dojo: { name: dir } };
    case "createdAt":
      return { createdAt: dir };
    default:
      return { fullName: dir };
  }
}

export function toggleSortKey(
  currentKey: string | null | undefined,
  currentDir: SortDir,
  nextKey: string,
): { key: string; dir: SortDir } {
  if (currentKey === nextKey) {
    return { key: nextKey, dir: currentDir === "asc" ? "desc" : "asc" };
  }
  return { key: nextKey, dir: "asc" };
}

export function compareStrings(
  a: string | null | undefined,
  b: string | null | undefined,
  dir: SortDir,
) {
  const av = (a ?? "").trim().toLocaleLowerCase("id");
  const bv = (b ?? "").trim().toLocaleLowerCase("id");
  const cmp = av.localeCompare(bv, "id", { sensitivity: "base" });
  return dir === "asc" ? cmp : -cmp;
}

export function compareNumbers(
  a: number | null | undefined,
  b: number | null | undefined,
  dir: SortDir,
) {
  const av = a ?? Number.NEGATIVE_INFINITY;
  const bv = b ?? Number.NEGATIVE_INFINITY;
  return dir === "asc" ? av - bv : bv - av;
}

export function compareDates(
  a: string | null | undefined,
  b: string | null | undefined,
  dir: SortDir,
) {
  const at = a ? new Date(a).getTime() : 0;
  const bt = b ? new Date(b).getTime() : 0;
  return dir === "asc" ? at - bt : bt - at;
}
