"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RantingOption } from "@/lib/public-ranting-filter";

type Props = {
  options: RantingOption[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  disabled?: boolean;
  className?: string;
};

export function RantingCheckboxFilter({
  options,
  selected,
  onChange,
  disabled = false,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const allSelected =
    options.length > 0 && options.every((o) => selected.has(o.name));
  const label =
    selected.size === 0 ? "Ranting" : `Ranting (${selected.size})`;

  function toggle(name: string) {
    const next = new Set(selected);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    onChange(next);
  }

  function selectAll() {
    onChange(new Set(options.map((o) => o.name)));
  }

  function reset() {
    onChange(new Set());
  }

  return (
    <div ref={wrapRef} className={cn("relative shrink-0", className)}>
      <Button
        type="button"
        variant="outline"
        className="h-10"
        disabled={disabled || options.length === 0}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
      >
        <Filter className="mr-1 h-4 w-4" />
        {label}
        <ChevronDown
          className={cn(
            "ml-1 h-4 w-4 transition-transform",
            open && "rotate-180",
          )}
        />
      </Button>

      {open ? (
        <div
          role="listbox"
          aria-multiselectable
          className="absolute right-0 z-50 mt-1 w-[min(calc(100vw-2rem),18rem)] rounded-md border border-border bg-popover p-2 shadow-md sm:w-72"
        >
          <div className="mb-2 flex items-center justify-between gap-2 px-1">
            <span className="text-xs font-medium text-muted-foreground">
              Filter ranting
            </span>
            {options.length > 0 ? (
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={allSelected ? reset : selectAll}
                >
                  {allSelected ? "Reset" : "Pilih semua"}
                </Button>
              </div>
            ) : null}
          </div>
          <div className="max-h-[min(50vh,20rem)] space-y-0.5 overflow-y-auto">
            {options.length === 0 ? (
              <p className="px-2 py-3 text-sm text-muted-foreground">
                Belum ada peserta terdaftar.
              </p>
            ) : (
              options.map((opt) => (
                <label
                  key={opt.name}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/60"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-inkai-red"
                    checked={selected.has(opt.name)}
                    onChange={() => toggle(opt.name)}
                  />
                  <span className="min-w-0 flex-1 truncate">{opt.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {opt.count}
                  </span>
                </label>
              ))
            )}
          </div>
          {selected.size > 0 ? (
            <div className="mt-2 border-t pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-full text-xs"
                onClick={reset}
              >
                Tampilkan semua ranting
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
