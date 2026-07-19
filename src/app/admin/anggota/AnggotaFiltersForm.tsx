"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";

type DojoOption = { id: string; name: string };

type FilterValues = {
  q: string;
  status: string;
  dojoId: string;
  docs: string;
  nia: string;
  inactiveMonths: string;
  pageSize: string;
};

function buildHref(values: FilterValues) {
  const params = new URLSearchParams();
  if (values.q.trim()) params.set("q", values.q.trim());
  if (values.status) params.set("status", values.status);
  if (values.dojoId) params.set("dojoId", values.dojoId);
  if (values.docs) params.set("docs", values.docs);
  if (values.nia) params.set("nia", values.nia);
  if (values.inactiveMonths) params.set("inactiveMonths", values.inactiveMonths);
  if (values.pageSize && values.pageSize !== "25") {
    params.set("pageSize", values.pageSize);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "?";
}

const STATUS_OPTIONS = [
  { value: "", label: "Semua status" },
  { value: "PENDING", label: "Menunggu" },
  { value: "Active", label: "Aktif" },
  { value: "INACTIVE", label: "Nonaktif" },
  { value: "SUSPENDED", label: "Ditangguhkan" },
  { value: "REJECTED", label: "Ditolak" },
] as const;

export function AnggotaFiltersForm({
  q,
  status,
  dojoId,
  docs,
  nia,
  inactiveMonths,
  pageSize,
  dojos = [],
  showDojoFilter = false,
  lockDojoId = "",
}: {
  q: string;
  status: string;
  dojoId: string;
  docs: string;
  nia: string;
  inactiveMonths: string;
  pageSize: string;
  dojos?: DojoOption[];
  showDojoFilter?: boolean;
  /** Dojo terkunci (single ranting) — tetap dikirim di query. */
  lockDojoId?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState(q);
  const [filters, setFilters] = useState({
    status,
    dojoId,
    docs,
    nia,
    inactiveMonths,
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (document.activeElement === inputRef.current) return;
    setQuery(q);
  }, [q]);

  useEffect(() => {
    setFilters({ status, dojoId, docs, nia, inactiveMonths });
  }, [status, dojoId, docs, nia, inactiveMonths]);

  useEffect(() => {
    return () => clearTimeout(debounceRef.current);
  }, []);

  const navigate = (nextQ: string, nextFilters: typeof filters) => {
    const href = buildHref({
      q: nextQ,
      status: nextFilters.status,
      dojoId: lockDojoId || nextFilters.dojoId,
      docs: nextFilters.docs,
      nia: nextFilters.nia,
      inactiveMonths: nextFilters.inactiveMonths,
      pageSize,
    });
    startTransition(() => {
      router.push(`${pathname}${href === "?" ? "" : href}`);
    });
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      navigate(value, filters);
    }, 250);
  };

  const handleFilterChange = (key: keyof typeof filters, value: string) => {
    const next = { ...filters, [key]: value };
    setFilters(next);
    clearTimeout(debounceRef.current);
    navigate(query, next);
  };

  const hasFilters = Boolean(
    query.trim() ||
      filters.status ||
      (!lockDojoId && filters.dojoId) ||
      filters.docs ||
      filters.nia ||
      filters.inactiveMonths,
  );

  const resetHref =
    pageSize && pageSize !== "25"
      ? `${pathname}?pageSize=${pageSize}`
      : pathname;

  return (
    <div className="mb-4 flex flex-wrap items-end gap-2">
      <div className="min-w-[180px] flex-1 space-y-1">
        <label className="text-xs text-muted-foreground">Pencarian</label>
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder="Cari nama / NIA..."
          autoComplete="off"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Status</label>
        <select
          value={filters.status}
          onChange={(e) => handleFilterChange("status", e.target.value)}
          className="h-8 min-w-[140px] rounded-lg border px-2 text-sm"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value || "all"} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {showDojoFilter ? (
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Dojo / Ranting</label>
          <select
            value={filters.dojoId}
            onChange={(e) => handleFilterChange("dojoId", e.target.value)}
            className="h-8 min-w-[160px] rounded-lg border px-2 text-sm"
          >
            <option value="">Semua dojo</option>
            {dojos.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Dokumen</label>
        <select
          value={filters.docs}
          onChange={(e) => handleFilterChange("docs", e.target.value)}
          className="h-8 min-w-[160px] rounded-lg border px-2 text-sm"
        >
          <option value="">Semua dokumen</option>
          <option value="incomplete">Belum lengkap</option>
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">NIA</label>
        <select
          value={filters.nia}
          onChange={(e) => handleFilterChange("nia", e.target.value)}
          className="h-8 min-w-[140px] rounded-lg border px-2 text-sm"
        >
          <option value="">Semua NIA</option>
          <option value="missing">Belum ada NIA</option>
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Nonaktif ≥</label>
        <select
          value={filters.inactiveMonths}
          onChange={(e) =>
            handleFilterChange("inactiveMonths", e.target.value)
          }
          className="h-8 min-w-[120px] rounded-lg border px-2 text-sm"
        >
          <option value="">Semua</option>
          <option value="3">3 bulan</option>
          <option value="6">6 bulan</option>
          <option value="12">12 bulan</option>
        </select>
      </div>

      {hasFilters ? (
        <Link
          href={resetHref}
          className="inline-flex h-8 items-center rounded-lg border px-3 text-sm hover:bg-muted"
        >
          Reset
        </Link>
      ) : null}
    </div>
  );
}
