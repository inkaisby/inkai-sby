"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { SortDir, SortRule } from "@/lib/table-sort";

export function SortableTableHead({
  label,
  sortKey,
  activeKey,
  activeDir = "asc",
  sortRules,
  onSort,
  className,
}: {
  label: string;
  sortKey: string;
  activeKey?: string | null;
  activeDir?: SortDir;
  sortRules?: SortRule[];
  onSort: (key: string, e?: React.MouseEvent) => void;
  className?: string;
}) {
  let active = false;
  let dir: SortDir = activeDir;
  let badgeNumber: number | undefined = undefined;

  if (sortRules && sortRules.length > 0) {
    const idx = sortRules.findIndex((r) => r.key === sortKey);
    if (idx !== -1) {
      active = true;
      dir = sortRules[idx].dir;
      if (sortRules.length > 1) {
        badgeNumber = idx + 1;
      }
    }
  } else {
    active = activeKey === sortKey;
    dir = activeDir;
  }

  const Icon = active
    ? dir === "asc"
      ? ArrowUp
      : ArrowDown
    : ArrowUpDown;

  return (
    <TableHead className={className}>
      <button
        type="button"
        className={cn(
          "inline-flex max-w-full items-center gap-1 text-left text-xs font-medium transition-colors select-none",
          active
            ? "font-semibold text-inkai-red"
            : "text-muted-foreground hover:text-foreground",
        )}
        onClick={(e) => onSort(sortKey, e)}
        aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
        title="Klik untuk urutkan. Tahan Shift + Klik untuk urutkan bertingkat (multi-column)."
      >
        <span>{label}</span>
        <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
        {badgeNumber !== undefined && (
          <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-inkai-red text-[10px] font-bold text-white px-1 leading-none shadow-xs">
            {badgeNumber}
          </span>
        )}
      </button>
    </TableHead>
  );
}

