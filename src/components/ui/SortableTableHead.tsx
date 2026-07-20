"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { SortDir } from "@/lib/table-sort";

export function SortableTableHead({
  label,
  sortKey,
  activeKey,
  activeDir = "asc",
  onSort,
  className,
}: {
  label: string;
  sortKey: string;
  activeKey?: string | null;
  activeDir?: SortDir;
  onSort: (key: string) => void;
  className?: string;
}) {
  const active = activeKey === sortKey;
  const Icon = active
    ? activeDir === "asc"
      ? ArrowUp
      : ArrowDown
    : ArrowUpDown;

  return (
    <TableHead className={className}>
      <button
        type="button"
        className={cn(
          "inline-flex max-w-full items-center gap-1 text-left text-xs font-medium transition-colors",
          active
            ? "text-inkai-red"
            : "text-muted-foreground hover:text-foreground",
        )}
        onClick={() => onSort(sortKey)}
        aria-sort={active ? (activeDir === "asc" ? "ascending" : "descending") : "none"}
      >
        <span>{label}</span>
        <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
      </button>
    </TableHead>
  );
}
