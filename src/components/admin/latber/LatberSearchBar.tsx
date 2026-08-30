"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatMemberName, formatRankLabel } from "@/lib/belt";
import type { LatberMemberRow } from "@/lib/latber";
import { EventQuickRegisterButtons } from "@/components/admin/event-quick-register/EventQuickRegisterButtons";

type RemoteSuggestion = {
  id: string;
  fullName: string;
  nia: string | null;
  dojoName?: string;
  currentRank?: string;
  registeredLatber?: boolean;
};

type Props = {
  allRows: LatberMemberRow[];
  value: string;
  onChange: (q: string) => void;
  placeholder?: string;
  enableRemoteSuggest?: boolean;
  dojoFilter?: string;
  onSelectRemote?: (member: RemoteSuggestion) => void;
  showDojoInSuggest?: boolean;
  disabled?: boolean;
  latberEventId?: string;
  canQuickRegister?: boolean;
  onQuickRegister?: (member: RemoteSuggestion) => void | Promise<void>;
  registerPendingId?: string | null;
};

function matchQuery(row: LatberMemberRow, q: string) {
  const needle = q.toLowerCase();
  return (
    row.fullName.toLowerCase().includes(needle) ||
    (row.nia?.toLowerCase().includes(needle) ?? false)
  );
}

function isLocalRegistered(row: LatberMemberRow): boolean {
  if (!row.registrationId) return false;
  const st = String(row.status ?? "").toUpperCase();
  if (st === "CANCELLED" || st === "REJECTED" || st === "BELUM_DAFTAR") {
    return false;
  }
  return true;
}

export function LatberSearchBar({
  allRows,
  value,
  onChange,
  placeholder = "Cari nama atau NIA…",
  enableRemoteSuggest = false,
  dojoFilter = "",
  onSelectRemote,
  showDojoInSuggest = false,
  disabled = false,
  latberEventId = "",
  canQuickRegister = false,
  onQuickRegister,
  registerPendingId = null,
}: Props) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [remote, setRemote] = useState<RemoteSuggestion[]>([]);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [optimisticRegistered, setOptimisticRegistered] = useState<Set<string>>(
    () => new Set(),
  );
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
    | { kind: "local"; row: LatberMemberRow }
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
    if (!enableRemoteSuggest || disabled) {
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
      if (latberEventId) params.set("latberEventId", latberEventId);
      void fetch(`/api/admin/latber/suggest?${params}`)
        .then(async (res) => {
          const data = (await res.json()) as { suggestions?: RemoteSuggestion[] };
          if (res.ok) setRemote(data.suggestions ?? []);
          else setRemote([]);
        })
        .catch(() => setRemote([]))
        .finally(() => setRemoteLoading(false));
    }, 220);
    return () => clearTimeout(remoteDebounceRef.current);
  }, [query, enableRemoteSuggest, dojoFilter, disabled, latberEventId]);

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

  function memberFromItem(item: CombinedItem): RemoteSuggestion {
    return item.kind === "local"
      ? {
          id: item.row.memberId,
          fullName: item.row.fullName,
          nia: item.row.nia ?? null,
          dojoName: item.row.dojoName ?? undefined,
          currentRank: item.row.currentRank ?? undefined,
        }
      : item.member;
  }

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
    <div ref={wrapperRef} className="relative min-w-0 flex-1 max-w-md">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        value={query}
        disabled={disabled}
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
          className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-md border border-border bg-popover py-1 text-sm shadow-md"
          role="listbox"
        >
          {remoteLoading && suggestions.length === 0 ? (
            <li className="px-3 py-2 text-muted-foreground">Mencari…</li>
          ) : null}
          {suggestions.map((item, idx) => {
            const key =
              item.kind === "local" ? item.row.memberId : `r-${item.member.id}`;
            const memberId =
              item.kind === "local" ? item.row.memberId : item.member.id;
            const name =
              item.kind === "local"
                ? formatMemberName(item.row.fullName)
                : formatMemberName(item.member.fullName);
            const nia = item.kind === "local" ? item.row.nia : item.member.nia;
            const registered =
              optimisticRegistered.has(memberId) ||
              (item.kind === "local"
                ? isLocalRegistered(item.row)
                : Boolean(item.member.registeredLatber));
            const rank =
              item.kind === "local"
                ? formatRankLabel(item.row.currentRank || "") || item.row.currentRank
                : formatRankLabel(item.member.currentRank || "") ||
                  item.member.currentRank;
            const dojoName =
              item.kind === "local" ? item.row.dojoName : item.member.dojoName;
            const metaParts = [nia, rank];
            if (showDojoInSuggest && dojoName) metaParts.push(dojoName);
            const showDaftar =
              canQuickRegister && Boolean(onQuickRegister) && !registered;
            return (
              <li
                key={key}
                role="option"
                aria-selected={idx === activeIndex}
                className={cn(
                  "border-b border-border/40 px-3 py-2 last:border-0",
                  idx === activeIndex && "bg-muted/60",
                )}
              >
                <div
                  className="min-w-0 cursor-pointer rounded-sm hover:bg-muted/60"
                  role="button"
                  tabIndex={0}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pickItem(item)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      pickItem(item);
                    }
                  }}
                >
                  <p className="truncate font-medium">{name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {metaParts.filter(Boolean).join(" · ")}
                  </p>
                </div>
                {showDaftar ? (
                  <div className="mt-2">
                    <EventQuickRegisterButtons
                      variant="latber"
                      memberId={memberId}
                      latberEventId={latberEventId}
                      registeredLatber={registered}
                      onRegister={async () => {
                        if (!canQuickRegister || !onQuickRegister) return;
                        const member = memberFromItem(item);
                        await onQuickRegister(member);
                        setOptimisticRegistered((prev) =>
                          new Set(prev).add(member.id),
                        );
                        setRemote((prev) =>
                          prev.map((s) =>
                            s.id === member.id
                              ? { ...s, registeredLatber: true }
                              : s,
                          ),
                        );
                      }}
                      pendingMemberId={registerPendingId}
                      pendingKind="latber"
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
