"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

const STORAGE_KEY = "inkai.admin.anggota.bulkSelection";

/** Query yang memengaruhi daftar (bukan page / pageSize). */
const FILTER_KEYS = [
  "q",
  "status",
  "dojoId",
  "docs",
  "nia",
  "inactiveMonths",
] as const;

type StoredSelection = {
  filterKey: string;
  statusById: Record<string, string>;
};

function buildFilterKey(searchParams: URLSearchParams) {
  return FILTER_KEYS.map((k) => `${k}=${searchParams.get(k) || ""}`).join("&");
}

/**
 * Seleksi bulk yang tetap ada saat ganti page / pageSize.
 * Di-reset jika filter pencarian berubah.
 */
export function usePersistedBulkSelection() {
  const searchParams = useSearchParams();
  const filterKey = useMemo(
    () => buildFilterKey(searchParams),
    [searchParams],
  );

  const [statusById, setStatusById] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as StoredSelection;
        if (
          parsed?.filterKey === filterKey &&
          parsed.statusById &&
          typeof parsed.statusById === "object"
        ) {
          setStatusById(parsed.statusById);
        } else {
          setStatusById({});
          sessionStorage.removeItem(STORAGE_KEY);
        }
      } else {
        setStatusById({});
      }
    } catch {
      setStatusById({});
    }
    setReady(true);
  }, [filterKey]);

  useEffect(() => {
    if (!ready) return;
    try {
      if (Object.keys(statusById).length === 0) {
        sessionStorage.removeItem(STORAGE_KEY);
      } else {
        const payload: StoredSelection = { filterKey, statusById };
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      }
    } catch {
      /* ignore quota */
    }
  }, [statusById, filterKey, ready]);

  const selectedIds = useMemo(
    () => new Set(Object.keys(statusById)),
    [statusById],
  );

  const toggleSelect = useCallback((id: string, status: string) => {
    setStatusById((prev) => {
      const next = { ...prev };
      if (next[id] !== undefined) delete next[id];
      else next[id] = status.trim().toUpperCase();
      return next;
    });
  }, []);

  /** Tambah/hapus hanya ID di halaman ini; seleksi halaman lain tetap. */
  const toggleSelectPage = useCallback(
    (pageRows: Array<{ id: string; status: string }>) => {
      setStatusById((prev) => {
        const next = { ...prev };
        const allOnPage =
          pageRows.length > 0 && pageRows.every((r) => next[r.id] !== undefined);
        if (allOnPage) {
          for (const r of pageRows) delete next[r.id];
        } else {
          for (const r of pageRows) {
            next[r.id] = r.status.trim().toUpperCase();
          }
        }
        return next;
      });
    },
    [],
  );

  const clearSelection = useCallback(() => {
    setStatusById({});
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const pendingSelectedIds = useMemo(
    () =>
      Object.entries(statusById)
        .filter(([, s]) => s === "PENDING")
        .map(([id]) => id),
    [statusById],
  );

  return {
    selectedIds,
    statusById,
    pendingSelectedIds,
    toggleSelect,
    toggleSelectPage,
    clearSelection,
    ready,
  };
}
