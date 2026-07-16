"use client";

type SettingsPaginationProps = {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  baseParams: Record<string, string>;
  pageSizeOptions?: number[];
};

export function SettingsPagination({
  page,
  totalPages,
  total,
  pageSize,
  baseParams,
  pageSizeOptions = [10, 50, 100, 1000],
}: SettingsPaginationProps) {
  if (total === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  function href(p: number, size = pageSize) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(baseParams)) {
      if (v) qs.set(k, v);
    }
    qs.set("page", String(p));
    qs.set("pageSize", String(size));
    return `?${qs.toString()}`;
  }

  return (
    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-muted-foreground">
          Menampilkan {from}–{to} dari {total}
        </p>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Per halaman</span>
          <select
            className="h-8 rounded-lg border bg-background px-2 text-sm text-foreground"
            value={pageSize}
            onChange={(e) => {
              window.location.href = href(1, Number(e.target.value));
            }}
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </div>
      {totalPages > 1 ? (
        <div className="flex flex-wrap gap-1.5 text-sm">
          {page > 1 ? (
            <a
              href={href(page - 1)}
              className="rounded-lg border px-2.5 py-1 hover:bg-muted"
            >
              Prev
            </a>
          ) : null}
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => {
              if (totalPages <= 7) return true;
              return p === 1 || p === totalPages || Math.abs(p - page) <= 1;
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
            <a
              href={href(page + 1)}
              className="rounded-lg border px-2.5 py-1 hover:bg-muted"
            >
              Next
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
