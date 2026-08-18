"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type KwitansiMemberSuggestItem = {
  id: string;
  fullName: string;
  nia: string | null;
  mshNumber: string | null;
  currentRank: string;
  dojoName: string;
  officerTitle: string;
  signatureUrl?: string | null;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  onPick?: (item: KwitansiMemberSuggestItem) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

export function KwitansiMemberPicker({
  value,
  onChange,
  onPick,
  placeholder = "Cari nama anggota (≥2 huruf)…",
  disabled,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<KwitansiMemberSuggestItem[]>([]);
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
      setOpen(false);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setLoading(true);
      void fetch(
        `/api/admin/kwitansi/member-suggest?q=${encodeURIComponent(q)}`,
      )
        .then(async (res) => {
          if (!res.ok) {
            toast.error("Gagal mencari anggota");
            setItems([]);
            return;
          }
          const data = (await res.json().catch(() => ({}))) as {
            suggestions?: KwitansiMemberSuggestItem[];
          };
          setItems(data.suggestions ?? []);
          setOpen(true);
        })
        .catch(() => {
          toast.error("Jaringan error — coba lagi");
          setItems([]);
        })
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(debounceRef.current);
  }, [value]);

  const pick = (item: KwitansiMemberSuggestItem) => {
    onChange(item.fullName);
    onPick?.(item);
    setOpen(false);
    setActive(-1);
  };

  return (
    <div ref={wrapRef} className={cn("relative z-[80]", className)}>
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
      {loading ? (
        <p className="mt-1 text-[11px] text-muted-foreground">Mencari…</p>
      ) : null}
      {open && items.length > 0 ? (
        <ul className="absolute z-[90] mt-1 max-h-56 w-full overflow-auto rounded-md border bg-background shadow-lg">
          {items.map((item, idx) => (
            <li key={item.id}>
              <button
                type="button"
                className={cn(
                  "flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-muted",
                  idx === active && "bg-muted",
                )}
                onMouseEnter={() => setActive(idx)}
                onClick={() => pick(item)}
              >
                <span className="font-medium">{item.fullName}</span>
                <span className="text-xs text-muted-foreground">
                  {[item.nia, item.currentRank, item.dojoName]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
