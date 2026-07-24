"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildUktAdminUrl, type UktSemester } from "@/lib/ukt";
import { cn } from "@/lib/utils";

type Props = {
  semester: UktSemester;
  year: number;
  createMode?: boolean;
  basePath?: "/admin/ukt" | "/admin/ukt/arsip";
  className?: string;
};

/**
 * Toolbar semester/tahun ringan — dirender di luar Suspense data berat
 * agar navigasi UKT terasa instan (data tabel menyusul di bawah).
 */
export function UktTermNav({
  semester,
  year,
  createMode = false,
  basePath = "/admin/ukt",
  className,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [yearInput, setYearInput] = useState(String(year));

  useEffect(() => {
    setYearInput(String(year));
  }, [year]);

  function go(next: { semester?: UktSemester; year?: number }) {
    const s = next.semester ?? semester;
    const y = next.year ?? year;
    const href = buildUktAdminUrl(s, y, null, {
      create: createMode,
      basePath,
    });
    startTransition(() => {
      router.replace(href, { scroll: false });
    });
  }

  return (
    <div
      className={cn(
        "sticky top-12 z-30 -mx-3 mb-3 space-y-2 border-b border-border/50 bg-background/95 px-3 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-background/90 sm:top-16 sm:-mx-6 sm:mb-4 sm:px-6 sm:py-3",
        pending && "opacity-80",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={semester}
          onValueChange={(v) => go({ semester: v as UktSemester })}
        >
          <SelectTrigger
            className="h-9 w-[8.5rem] border-border/80 bg-background text-sm font-medium shadow-none sm:h-8"
            aria-label="Pilih semester UKT"
          >
            <SelectValue placeholder="Semester" />
          </SelectTrigger>
          <SelectContent className="min-w-[8.5rem]">
            <SelectItem value="I">Semester I</SelectItem>
            <SelectItem value="II">Semester II</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="number"
          className="h-9 w-20 text-sm font-medium sm:h-8"
          value={yearInput}
          onChange={(e) => setYearInput(e.target.value)}
          onBlur={() => {
            const y = parseInt(yearInput, 10);
            if (Number.isFinite(y) && y >= 2020 && y <= 2100) {
              if (y !== year) go({ year: y });
            } else {
              setYearInput(String(year));
            }
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.currentTarget.blur();
          }}
          min={2020}
          max={2100}
          aria-label="Tahun UKT"
        />
        {pending ? (
          <span className="text-xs text-muted-foreground">Memuat…</span>
        ) : null}
      </div>
    </div>
  );
}
