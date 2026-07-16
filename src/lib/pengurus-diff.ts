import type { PengurusPeriod } from "@/lib/struktur-pengurus";

export type PengurusChangeEntry = {
  id: string;
  at: string;
  byEmail: string;
  action: string;
  periodId: string;
  periodeLabel: string;
  summary: string;
  changes: Array<{ path: string; from: string; to: string }>;
};

function personLabel(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value && "name" in value) {
    return String((value as { name?: string }).name ?? "");
  }
  return JSON.stringify(value);
}

function flattenPeriod(
  period: PengurusPeriod,
  prefix = "",
): Record<string, string> {
  const out: Record<string, string> = {};
  const put = (path: string, val: string) => {
    out[prefix ? `${prefix}.${path}` : path] = val;
  };

  put("periode", period.periode);
  put("pelindung", period.pelindung);
  put("isActive", String(period.isActive));
  put("document.title", period.document?.title ?? "");
  put("document.number", period.document?.number ?? "");
  put("document.date", period.document?.date ?? "");
  put("document.url", period.document?.url ?? "");

  period.penasihat.forEach((p, i) => {
    put(`penasihat.${i}`, personLabel(p));
  });

  (["ketua", "koordinatorMsh", "wakilKetua", "sekretaris", "bendahara"] as const).forEach(
    (key) => put(`inti.${key}`, personLabel(period.inti[key])),
  );

  period.bidang.forEach((b, bi) => {
    put(`bidang.${bi}.title`, b.title);
    if (b.head) put(`bidang.${bi}.head`, personLabel(b.head));
    b.members?.forEach((m, mi) => put(`bidang.${bi}.members.${mi}`, personLabel(m)));
    b.seksi?.forEach((s, si) => {
      put(`bidang.${bi}.seksi.${si}.title`, s.title);
      s.members.forEach((m, mi) =>
        put(`bidang.${bi}.seksi.${si}.members.${mi}`, personLabel(m)),
      );
    });
  });

  return out;
}

export function diffPengurusPeriods(
  before: PengurusPeriod | null,
  after: PengurusPeriod,
): Array<{ path: string; from: string; to: string }> {
  const a = before ? flattenPeriod(before) : {};
  const b = flattenPeriod(after);
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const changes: Array<{ path: string; from: string; to: string }> = [];

  for (const key of keys) {
    const from = a[key] ?? "";
    const to = b[key] ?? "";
    if (from !== to) changes.push({ path: key, from, to });
  }

  return changes;
}

export function summarizeChanges(
  changes: Array<{ path: string; from: string; to: string }>,
): string {
  if (changes.length === 0) return "Tidak ada perubahan field";
  if (changes.length <= 3) {
    return changes.map((c) => c.path).join(", ");
  }
  return `${changes.length} field berubah (${changes
    .slice(0, 3)
    .map((c) => c.path)
    .join(", ")}…)`;
}
