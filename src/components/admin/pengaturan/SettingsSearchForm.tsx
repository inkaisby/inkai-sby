"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";

type FilterOption = { value: string; label: string };

function buildSearchUrl(
  pathname: string,
  {
    q,
    filterName,
    filterValue,
    extraHidden,
  }: {
    q: string;
    filterName?: string;
    filterValue?: string;
    extraHidden?: Record<string, string>;
  },
) {
  const params = new URLSearchParams();
  const trimmed = q.trim();
  if (trimmed) params.set("q", trimmed);
  if (filterName && filterValue) params.set(filterName, filterValue);
  if (extraHidden) {
    for (const [name, value] of Object.entries(extraHidden)) {
      if (value) params.set(name, value);
    }
  }
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

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
  /** Extra query keys to preserve (e.g. pageSize, branchId). Page is omitted to reset. */
  extraHidden?: Record<string, string>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState(q);
  const [filter, setFilter] = useState(filterValue || "");
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const [, startTransition] = useTransition();

  useEffect(() => {
    // Jangan timpa input saat user masih mengetik (navigasi async).
    if (document.activeElement === inputRef.current) return;
    setQuery(q);
  }, [q]);

  useEffect(() => {
    setFilter(filterValue || "");
  }, [filterValue]);

  useEffect(() => {
    return () => clearTimeout(debounceRef.current);
  }, []);

  const navigate = (nextQ: string, nextFilter: string) => {
    const href = buildSearchUrl(pathname, {
      q: nextQ,
      filterName,
      filterValue: nextFilter,
      extraHidden,
    });
    startTransition(() => {
      router.push(href);
    });
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      navigate(value, filter);
    }, 250);
  };

  const handleFilterChange = (value: string) => {
    setFilter(value);
    clearTimeout(debounceRef.current);
    navigate(query, value);
  };

  return (
    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="min-w-0 w-full space-y-1 sm:min-w-[200px] sm:flex-1 sm:max-w-md">
        <label className="text-xs text-muted-foreground">Pencarian</label>
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder={qPlaceholder}
          autoComplete="off"
          className="h-10 sm:h-8"
        />
      </div>
      {filterName && filterOptions ? (
        <div className="w-full space-y-1 sm:w-auto">
          <label className="text-xs text-muted-foreground">{filterLabel}</label>
          <select
            value={filter}
            onChange={(e) => handleFilterChange(e.target.value)}
            className="h-10 w-full rounded-lg border px-2 text-sm sm:h-8 sm:min-w-[140px] sm:w-auto"
          >
            {filterOptions.map((opt) => (
              <option key={opt.value || "all"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </div>
  );
}
