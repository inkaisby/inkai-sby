import { Input } from "@/components/ui/input";

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

export function SettingsPagination({
  page,
  totalPages,
  total,
  pageSize,
  baseParams,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  baseParams: Record<string, string>;
}) {
  if (total === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  function href(p: number) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(baseParams)) {
      if (v) qs.set(k, v);
    }
    qs.set("page", String(p));
    return `?${qs.toString()}`;
  }

  return (
    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        Menampilkan {from}–{to} dari {total}
      </p>
      {totalPages > 1 ? (
        <div className="flex flex-wrap gap-1.5 text-sm">
          {page > 1 ? (
            <a href={href(page - 1)} className="rounded-lg border px-2.5 py-1 hover:bg-muted">
              Prev
            </a>
          ) : null}
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => {
              if (totalPages <= 7) return true;
              return (
                p === 1 ||
                p === totalPages ||
                Math.abs(p - page) <= 1
              );
            })
            .reduce<number[]>((acc, p, idx, arr) => {
              if (idx > 0 && p - arr[idx - 1]! > 1) acc.push(-1);
              acc.push(p);
              return acc;
            }, [])
            .map((p, idx) =>
              p === -1 ? (
                <span key={`e-${idx}`} className="px-1 text-muted-foreground">
                  …
                </span>
              ) : (
                <a
                  key={p}
                  href={href(p)}
                  className={`rounded-lg px-2.5 py-1 ${
                    p === page
                      ? "bg-inkai-red text-white"
                      : "border hover:bg-muted"
                  }`}
                >
                  {p}
                </a>
              ),
            )}
          {page < totalPages ? (
            <a href={href(page + 1)} className="rounded-lg border px-2.5 py-1 hover:bg-muted">
              Next
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function parsePage(raw: string | undefined, fallback = 1) {
  return Math.max(1, parseInt(raw || String(fallback), 10) || fallback);
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
