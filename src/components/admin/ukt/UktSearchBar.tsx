"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatMemberName, formatRankLabel } from "@/lib/belt";
import type { UktMemberRow } from "@/lib/ukt";

type RemoteSuggestion = {
  id: string;
  fullName: string;
  nia: string | null;
  dojoName?: string;
  currentRank?: string;
};

type Props = {
  allRows: UktMemberRow[];
  value: string;
  onChange: (q: string) => void;
  placeholder?: string;
  showRegistrationStatus?: boolean;
  /** Aktifkan suggest API untuk Belum Daftar (registrants-first). */
  enableRemoteSuggest?: boolean;
  dojoFilter?: string;
  onSelectRemote?: (member: RemoteSuggestion) => void;
};

function matchQuery(row: UktMemberRow, q: string) {
  const needle = q.toLowerCase();
  return (
    row.fullName.toLowerCase().includes(needle) ||
    (row.nia?.toLowerCase().includes(needle) ?? false)
  );
}

export function UktSearchBar({
  allRows,
  value,
  onChange,
  placeholder = "Cari nama atau NIA…",
  showRegistrationStatus = false,
  enableRemoteSuggest = false,
  dojoFilter = "",
  onSelectRemote,
}: Props) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [remote, setRemote] = useState<RemoteSuggestion[]>([]);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const remoteDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const localSuggestions = useMemo(() => {
    if (query.trim().length < 2) return [];
    return allRows.filter((r) => matchQuery(r, query.trim())).slice(0, 8);
  }, [allRows, query]);

  const localIds = useMemo(
    () => new Set(localSuggestions.map((r) => r.memberId)),
    [localSuggestions],
  );

  const remoteOnly = useMemo(
    () => remote.filter((r) => !localIds.has(r.id)).slice(0, 6),
    [remote, localIds],
  );

  type CombinedItem =
    | { kind: "local"; row: UktMemberRow }
    | { kind: "remote"; member: RemoteSuggestion };

  const suggestions: CombinedItem[] = useMemo(() => {
    const items: CombinedItem[] = localSuggestions.map((row) => ({
      kind: "local" as const,
      row,
    }));
    for (const m of remoteOnly) {
      items.push({ kind: "remote", member: m });
    }
    return items.slice(0, 10);
  }, [localSuggestions, remoteOnly]);

  useEffect(() => {
    if (!enableRemoteSuggest) {
      setRemote([]);
      return;
    }
    const q = query.trim();
    if (q.length < 2) {
      setRemote([]);
      return;
    }
    clearTimeout(remoteDebounceRef.current);
    remoteDebounceRef.current = setTimeout(() => {
      setRemoteLoading(true);
      const params = new URLSearchParams({ q });
      if (dojoFilter) params.set("dojo", dojoFilter);
      void fetch(`/api/admin/ukt/suggest?${params}`)
        .then(async (res) => {
          const data = (await res.json()) as {
            suggestions?: RemoteSuggestion[];
          };
          const list = res.ok ? (data.suggestions ?? []) : [];
          // #region agent log
          fetch(
            "http://127.0.0.1:7385/ingest/dfa53adf-1e28-4ee0-ab88-bbc21b01308f",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Debug-Session-Id": "f0acf0",
              },
              body: JSON.stringify({
                sessionId: "f0acf0",
                hypothesisId: "A",
                location: "UktSearchBar.tsx:suggest",
                message: "client suggest response",
                data: {
                  ok: res.ok,
                  status: res.status,
                  count: list.length,
                  qLen: q.length,
                  hasDojoFilter: Boolean(dojoFilter),
                },
                timestamp: Date.now(),
              }),
            },
          ).catch(() => {});
          // #endregion
          if (res.ok) setRemote(list);
          else setRemote([]);
        })
        .catch(() => setRemote([]))
        .finally(() => setRemoteLoading(false));
    }, 220);
    return () => clearTimeout(remoteDebounceRef.current);
  }, [query, enableRemoteSuggest, dojoFilter]);

  const applySearch = useCallback(
    (q: string) => {
      setQuery(q);
      setOpen(false);
      setActiveIndex(-1);
      onChange(q.trim());
    },
    [onChange],
  );

  const handleInputChange = (v: string) => {
    setQuery(v);
    setActiveIndex(-1);
    setOpen(v.trim().length >= 2);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onChange(v.trim()), 180);
  };

  const pickItem = (item: CombinedItem) => {
    if (item.kind === "local") {
      applySearch(item.row.fullName);
      return;
    }
    onSelectRemote?.(item.member);
    applySearch(item.member.fullName);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || suggestions.length === 0) {
      if (e.key === "Enter") {
        e.preventDefault();
        clearTimeout(debounceRef.current);
        applySearch(query);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i < suggestions.length - 1 ? i + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i > 0 ? i - 1 : suggestions.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      clearTimeout(debounceRef.current);
      if (activeIndex >= 0) {
        pickItem(suggestions[activeIndex]);
      } else {
        applySearch(query);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  };

  const handleClear = () => {
    clearTimeout(debounceRef.current);
    setQuery("");
    setOpen(false);
    setRemote([]);
    onChange("");
    inputRef.current?.focus();
  };

  return (
    <div ref={wrapperRef} className="relative min-w-0 flex-1">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        value={query}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => query.trim().length >= 2 && setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="h-9 pr-8 pl-9 text-sm"
        aria-autocomplete="list"
        aria-expanded={open}
        autoComplete="off"
      />
      {query ? (
        <button
          type="button"
          onClick={handleClear}
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
          aria-label="Hapus pencarian"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
      {open && (suggestions.length > 0 || remoteLoading) ? (
        <ul
          className="absolute z-40 mt-1 max-h-64 w-full overflow-auto rounded-md border border-border bg-popover py-1 text-sm shadow-md"
          role="listbox"
        >
          {remoteLoading && suggestions.length === 0 ? (
            <li className="px-3 py-2 text-muted-foreground">Mencari…</li>
          ) : null}
          {suggestions.map((item, idx) => {
            const key =
              item.kind === "local" ? item.row.memberId : `r-${item.member.id}`;
            const name =
              item.kind === "local"
                ? formatMemberName(item.row.fullName)
                : formatMemberName(item.member.fullName);
            const nia =
              item.kind === "local" ? item.row.nia : item.member.nia;
            const registered =
              item.kind === "local" ? Boolean(item.row.registrationId) : false;
            const rank =
              item.kind === "local"
                ? item.row.memberCurrentRank || item.row.kyuLama
                : formatRankLabel(item.member.currentRank || "") ||
                  item.member.currentRank;
            return (
              <li key={key} role="option" aria-selected={idx === activeIndex}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-muted",
                    idx === activeIndex && "bg-muted",
                  )}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pickItem(item)}
                >
                  <span className="font-medium">{name}</span>
                  <span className="text-xs text-muted-foreground">
                    {[nia, rank, item.kind === "remote" ? item.member.dojoName : null]
                      .filter(Boolean)
                      .join(" · ")}
                    {showRegistrationStatus ? (
                      <>
                        {" · "}
                        {registered ? "Terdaftar" : "Belum daftar"}
                      </>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
