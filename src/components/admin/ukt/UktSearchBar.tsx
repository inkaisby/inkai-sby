"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatMemberName, formatRankLabel } from "@/lib/belt";
import type { UktMemberRow } from "@/lib/ukt";

type Props = {
  allRows: UktMemberRow[];
  value: string;
  onChange: (q: string) => void;
  placeholder?: string;
  showRegistrationStatus?: boolean;
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
}: Props) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
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

  const suggestions = useMemo(() => {
    if (query.trim().length < 2) return [];
    return allRows.filter((r) => matchQuery(r, query.trim())).slice(0, 8);
  }, [allRows, query]);

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
    clearTimeout(debounceRef.current);
    setQuery("");
    setOpen(false);
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
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (suggestions.length > 0) setOpen(true);
        }}
        placeholder={placeholder}
        className="pr-8 pl-8"
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
      />
      {query && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute top-1/2 right-2 z-10 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Hapus pencarian"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      {open && suggestions.length > 0 && (
        <ul
          className="absolute top-full right-0 left-0 z-50 mt-1 max-h-64 overflow-y-auto rounded-lg border bg-popover py-1 shadow-md ring-1 ring-foreground/10"
          role="listbox"
        >
          {suggestions.map((s, i) => (
            <li key={s.memberId} role="option" aria-selected={i === activeIndex}>
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
                <span className="min-w-0 flex-1 truncate font-medium">
                  {formatMemberName(s.fullName)}
                </span>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {s.nia || "—"}
                </span>
                <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                  {formatRankLabel(s.kyuLama) || "—"}
                </span>
                <span className="hidden shrink-0 text-xs text-muted-foreground md:inline">
                  {s.dojoName}
                </span>
                {showRegistrationStatus && (
                  <span
                    className={cn(
                      "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium",
                      s.registrationId
                        ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
                    )}
                  >
                    {s.registrationId ? "Terdaftar" : "Belum daftar"}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
