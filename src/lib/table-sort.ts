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

export type SortRule = {
  key: string;
  dir: SortDir;
};

export function compareDates(
  a: string | null | undefined,
  b: string | null | undefined,
  dir: SortDir,
) {
  const at = a ? new Date(a).getTime() : 0;
  const bt = b ? new Date(b).getTime() : 0;
  return dir === "asc" ? at - bt : bt - at;
}

export function rankBucketLabel(kyu: string | null | undefined): string {
  const raw = (kyu || "").trim();
  if (!raw) return "lainnya";
  const kyuMatch = raw.match(/\bkyu\s*(\d+)\b/i);
  if (kyuMatch) return `kyu ${kyuMatch[1]}`;
  const danMatch = raw.match(/\bdan\s*(\d+)\b/i);
  if (danMatch) return `dan ${danMatch[1]}`;
  return raw.toLowerCase();
}

/** Urut Kyu 10→1 (asc) lalu Dan 1→10; label lain di akhir (A–Z). */
export function compareRankBuckets(a: string, b: string, dir: SortDir): number {
  const parse = (label: string) => {
    const kyu = label.match(/^kyu\s*(\d+)$/i);
    if (kyu) return { kind: 0 as const, n: Number(kyu[1]) };
    const dan = label.match(/^dan\s*(\d+)$/i);
    if (dan) return { kind: 1 as const, n: Number(dan[1]) };
    return { kind: 2 as const, n: 0, label };
  };
  const pa = parse(a);
  const pb = parse(b);
  let cmp = 0;
  if (pa.kind !== pb.kind) cmp = pa.kind - pb.kind;
  else if (pa.kind === 0) cmp = pb.n - pa.n;
  else if (pa.kind === 1) cmp = pa.n - pb.n;
  else cmp = a.localeCompare(b, "id");
  return dir === "asc" ? cmp : -cmp;
}

