import { shortRankLabel } from "@/lib/belt";
import {
  compareDates,
  compareStrings,
  type SortDir,
} from "@/lib/table-sort";
import type { UktPublicRegistrant } from "@/lib/ukt-public";

function rankBucketLabel(kyu: string | null | undefined): string {
  const raw = (kyu || "").trim();
  const short = shortRankLabel(raw);
  if (!short) return "lainnya";
  return short.toLowerCase();
}

/** Urut Kyu 10→1 lalu Dan 1→10; label lain di akhir (A–Z). */
function compareRankBuckets(a: string, b: string, dir: SortDir): number {
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

export function comparePublicUktRows(
  a: UktPublicRegistrant,
  b: UktPublicRegistrant,
  key: string,
  dir: SortDir,
): number {
  switch (key) {
    case "nia":
      return compareStrings(a.nia, b.nia, dir);
    case "fullName":
      return compareStrings(a.fullName, b.fullName, dir);
    case "createdAt":
      return compareDates(a.createdAt, b.createdAt, dir);
    case "kyuLama":
      return compareRankBuckets(
        rankBucketLabel(a.kyuLama),
        rankBucketLabel(b.kyuLama),
        dir,
      );
    case "kyuBaru":
      return compareRankBuckets(
        rankBucketLabel(a.kyuBaru),
        rankBucketLabel(b.kyuBaru),
        dir,
      );
    case "ranting":
      return compareStrings(a.ranting, b.ranting, dir);
    case "status":
      return compareStrings(a.statusLabel, b.statusLabel, dir);
    default:
      return 0;
  }
}

/** Pertahankan urutan input bila `key` null (belum diklik user). */
export function sortPublicUktRows(
  rows: UktPublicRegistrant[],
  key: string | null,
  dir: SortDir,
): UktPublicRegistrant[] {
  if (!key) return rows;
  return [...rows].sort((a, b) => comparePublicUktRows(a, b, key, dir));
}

/**
 * Urutan cetak:
 * 1. Ranting A–Z (dikelompokkan, tidak dicampur antar ranting)
 * 2. Kyu Lama: Kyu 10→1, lalu Dan 1→10
 * 3. Kyu Baru: urutan yang sama
 * 4. Nama A–Z
 * Tidak terpengaruh sort UI layar.
 */
export function sortPublicUktRowsForPrint(
  rows: UktPublicRegistrant[],
): UktPublicRegistrant[] {
  return [...rows].sort((a, b) => {
    // 1. Kelompokkan per ranting
    const byRanting = (a.ranting || "").localeCompare(b.ranting || "", "id");
    if (byRanting !== 0) return byRanting;
    // 2. Kyu Lama (Kyu 10→1, lalu Dan 1→10)
    const byKyuLama = compareRankBuckets(
      rankBucketLabel(a.kyuLama),
      rankBucketLabel(b.kyuLama),
      "asc",
    );
    if (byKyuLama !== 0) return byKyuLama;
    // 3. Kyu Baru
    const byKyuBaru = compareRankBuckets(
      rankBucketLabel(a.kyuBaru),
      rankBucketLabel(b.kyuBaru),
      "asc",
    );
    if (byKyuBaru !== 0) return byKyuBaru;
    // 4. Nama
    return (a.fullName || "").localeCompare(b.fullName || "", "id");
  });
}
