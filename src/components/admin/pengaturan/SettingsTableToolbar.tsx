import { Input } from "@/components/ui/input";

export { SettingsPagination } from "./SettingsPagination";

type FilterOption = { value: string; label: string };

export function SettingsSearchForm({
  q,
  qPlaceholder = "Cari...",
  filterName,
  filterValue,
  filterOptions,
  filterLabel = "Filter",
  extraHidden,
}: {
  q: string;
  qPlaceholder?: string;
  filterName?: string;
  filterValue?: string;
  filterOptions?: FilterOption[];
  filterLabel?: string;
  /** Extra query keys to preserve as hidden inputs (e.g. page reset happens by omitting page) */
  extraHidden?: Record<string, string>;
}) {
  return (
    <form className="mb-4 flex flex-wrap items-end gap-2">
      {extraHidden &&
        Object.entries(extraHidden).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
      <div className="min-w-[200px] flex-1 space-y-1">
        <label className="text-xs text-muted-foreground">Pencarian</label>
        <Input name="q" placeholder={qPlaceholder} defaultValue={q} />
      </div>
      {filterName && filterOptions ? (
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">{filterLabel}</label>
          <select
            name={filterName}
            defaultValue={filterValue || ""}
            className="h-8 min-w-[140px] rounded-lg border px-2 text-sm"
          >
            {filterOptions.map((opt) => (
              <option key={opt.value || "all"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <button
        type="submit"
        className="h-8 rounded-lg bg-inkai-red px-4 text-sm text-white"
      >
        Cari
      </button>
    </form>
  );
}

export function parsePage(raw: string | undefined, fallback = 1) {
  return Math.max(1, parseInt(raw || String(fallback), 10) || fallback);
}

export function parsePageSize(
  raw: string | undefined,
  allowed: number[] = [10, 50, 100, 1000],
  fallback = 10,
) {
  const n = parseInt(raw || String(fallback), 10);
  if (allowed.includes(n)) return n;
  return fallback;
}

export function paginateSlice<T>(items: T[], page: number, pageSize: number) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    rows: items.slice(start, start + pageSize),
    total,
    totalPages,
    page: safePage,
    pageSize,
  };
}
