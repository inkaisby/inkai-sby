export { SettingsPagination } from "./SettingsPagination";
export { SettingsSearchForm } from "./SettingsSearchForm";

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
