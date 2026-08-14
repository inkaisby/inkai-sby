"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type UktTtdSuggestItem = {
  id: string;
  fullName: string;
  nia: string | null;
  mshNumber: string | null;
  currentRank: string;
  dojoName: string;
  officerTitle: string;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  onPick?: (item: UktTtdSuggestItem) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

export function UktTtdMemberPicker({
  value,
  onChange,
  onPick,
  placeholder = "Cari nama anggota (DAN)…",
  disabled,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<UktTtdSuggestItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setActive(-1);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    const q = value.trim();
    if (q.length < 2) {
      setItems([]);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setLoading(true);
      void fetch(`/api/admin/ukt/ttd-suggest?q=${encodeURIComponent(q)}`)
        .then(async (res) => {
          const data = (await res.json().catch(() => ({}))) as {
            suggestions?: UktTtdSuggestItem[];
          };
          setItems(data.suggestions ?? []);
          setOpen(true);
        })
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(debounceRef.current);
  }, [value]);

  const pick = (item: UktTtdSuggestItem) => {
    onChange(item.fullName);
    onPick?.(item);
    setOpen(false);
    setActive(-1);
  };

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <Input
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => items.length > 0 && setOpen(true)}
        onKeyDown={(e) => {
          if (!open || items.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, items.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter" && active >= 0) {
            e.preventDefault();
            pick(items[active]!);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {open && (items.length > 0 || loading) ? (
        <ul className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-popover p-1 text-sm shadow-md">
          {loading && items.length === 0 ? (
            <li className="px-2 py-1.5 text-muted-foreground">Mencari…</li>
          ) : (
            items.map((item, idx) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full flex-col items-start rounded px-2 py-1.5 text-left hover:bg-muted",
                    idx === active && "bg-muted",
                  )}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(item);
                  }}
                >
                  <span className="font-medium">{item.fullName}</span>
                  <span className="text-xs text-muted-foreground">
                    {item.currentRank}
                    {item.mshNumber ? ` · MSH ${item.mshNumber}` : ""}
                    {item.dojoName ? ` · ${item.dojoName}` : ""}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
