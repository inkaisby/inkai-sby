"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { shortRankLabel } from "@/lib/belt";

export type UktSearchSuggestion = {
  id: string;
  fullName: string;
  nia: string | null;
  dojoName: string;
  currentRank: string;
};

type Props = {
  value: string;
  onSearch: (q: string) => void;
  dojoFilter?: string;
  periodId?: string | null;
  placeholder?: string;
};

export function UktSearchBar({
  value,
  onSearch,
  dojoFilter,
  periodId,
  placeholder = "Cari nama atau NIA…",
}: Props) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<UktSearchSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const suggestTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
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

  const fetchSuggestions = useCallback(
    async (q: string) => {
      if (q.length < 2) {
        setSuggestions([]);
        return;
      }
      setLoading(true);
      try {
        const params = new URLSearchParams({ q });
        if (dojoFilter) params.set("dojo", dojoFilter);
        if (periodId) params.set("period", periodId);
        const res = await fetch(`/api/admin/ukt/suggest?${params}`);
        const data = await res.json();
        setSuggestions(data.suggestions || []);
        setOpen((data.suggestions || []).length > 0);
      } catch {
        setSuggestions([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    },
    [dojoFilter, periodId],
  );

  const applySearch = useCallback(
    (q: string) => {
      setQuery(q);
      setOpen(false);
      setSuggestions([]);
      setActiveIndex(-1);
      onSearch(q.trim());
    },
    [onSearch],
  );

  const handleInputChange = (v: string) => {
    setQuery(v);
    setActiveIndex(-1);
    clearTimeout(suggestTimer.current);
    clearTimeout(searchTimer.current);

    if (v.length >= 2) {
      suggestTimer.current = setTimeout(() => fetchSuggestions(v), 250);
    } else {
      setSuggestions([]);
      setOpen(false);
    }

    searchTimer.current = setTimeout(() => onSearch(v.trim()), 500);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || suggestions.length === 0) {
      if (e.key === "Enter") {
        e.preventDefault();
        clearTimeout(searchTimer.current);
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
      clearTimeout(searchTimer.current);
      if (activeIndex >= 0) {
        applySearch(suggestions[activeIndex].fullName);
      } else {
        applySearch(query);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  };

  const handleClear = () => {
    clearTimeout(suggestTimer.current);
    clearTimeout(searchTimer.current);
    setQuery("");
    setSuggestions([]);
    setOpen(false);
    onSearch("");
    inputRef.current?.focus();
  };

  return (
    <div ref={wrapperRef} className="relative min-w-0 flex-1">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        value={query}
        onChange={(e) => handleInputChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (suggestions.length > 0) setOpen(true);
        }}
        placeholder={placeholder}
        className="pr-16 pl-8"
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
      />
      <div className="absolute top-1/2 right-2 z-10 flex -translate-y-1/2 items-center gap-1">
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Hapus pencarian"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <ul
          className="absolute top-full right-0 left-0 z-50 mt-1 max-h-64 overflow-y-auto rounded-lg border bg-popover py-1 shadow-md ring-1 ring-foreground/10"
          role="listbox"
        >
          {suggestions.map((s, i) => (
            <li key={s.id} role="option" aria-selected={i === activeIndex}>
              <button
                type="button"
                className={cn(
                  "flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
                  i === activeIndex && "bg-muted",
                )}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applySearch(s.fullName)}
                onMouseEnter={() => setActiveIndex(i)}
              >
                <span className="min-w-0 flex-1 truncate font-medium">{s.fullName}</span>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {s.nia || "—"}
                </span>
                <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                  {shortRankLabel(s.currentRank)}
                </span>
                <span className="hidden shrink-0 text-xs text-muted-foreground md:inline">
                  {s.dojoName}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
