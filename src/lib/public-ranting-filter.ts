export type RantingOption = { name: string; count: number };

/** Opsi ranting dari daftar peserta (urut nama id). */
export function buildRantingOptions(
  rows: ReadonlyArray<{ rantingName: string }>,
): RantingOption[] {
  const map = new Map<string, number>();
  for (const row of rows) {
    const name = row.rantingName?.trim() || "—";
    map.set(name, (map.get(name) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "id"));
}

/** Buang centang ranting yang sudah tidak ada di data terbaru. */
export function pruneSelectedRanting(
  selected: Set<string>,
  options: RantingOption[],
): Set<string> {
  if (selected.size === 0) return selected;
  const valid = new Set(options.map((o) => o.name));
  const next = new Set([...selected].filter((n) => valid.has(n)));
  return next.size === selected.size ? selected : next;
}

export function matchesRantingFilter(
  rantingName: string,
  selected: Set<string>,
): boolean {
  if (selected.size === 0) return true;
  const name = rantingName?.trim() || "—";
  return selected.has(name);
}

export function matchesSearchFilter(
  q: string,
  fields: { fullName: string; nia?: string | null; rantingName: string },
): boolean {
  const needle = q.trim().toLowerCase();
  if (needle.length < 2) return true;
  return (
    fields.fullName.toLowerCase().includes(needle) ||
    (fields.nia?.toLowerCase().includes(needle) ?? false) ||
    fields.rantingName.toLowerCase().includes(needle)
  );
}

export const PUBLIC_STICKY_TOOLBAR_CLASS =
  "sticky top-14 z-40 -mx-4 space-y-2 border-b border-border/50 bg-background/95 px-4 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-background/90 sm:-mx-6 sm:top-16 sm:px-6 sm:py-3";
