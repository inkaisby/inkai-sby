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
        "sticky top-11 lg:top-12 z-30 -mx-3 mb-1.5 space-y-1 border-b border-border/30 bg-background/90 px-3 py-1 backdrop-blur-md 2xl:top-16 sm:-mx-6 sm:mb-2 sm:px-6 sm:py-1.5",
        pending && "opacity-80",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <Select
          value={semester}
          onValueChange={(v) => go({ semester: v as UktSemester })}
        >
          <SelectTrigger
            className="h-7.5 w-[7.5rem] border-border/80 bg-background text-xs font-medium shadow-none sm:h-7"
            aria-label="Pilih semester UKT"
          >
            <SelectValue placeholder="Semester" />
          </SelectTrigger>
          <SelectContent className="min-w-[7.5rem]">
            <SelectItem value="I">Semester I</SelectItem>
            <SelectItem value="II">Semester II</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="number"
          className="h-7.5 w-18 text-xs font-medium sm:h-7"
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

        {/* Tab switcher & Buat Periode cepat */}
        <div className="ml-auto flex items-center gap-1.5">
          <div className="flex items-center rounded-md border border-border/80 bg-muted/40 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => {
                const href = buildUktAdminUrl(semester, year, null, { basePath: "/admin/ukt" });
                startTransition(() => {
                  router.push(href);
                });
              }}
              className={cn(
                "rounded px-2 py-0.5 font-medium transition-colors",
                basePath === "/admin/ukt" && !createMode
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              📋 Pendaftaran
            </button>
            <button
              type="button"
              onClick={() => {
                const href = buildUktAdminUrl(semester, year, null, { basePath: "/admin/ukt/arsip" });
                startTransition(() => {
                  router.push(href);
                });
              }}
              className={cn(
                "rounded px-2 py-0.5 font-medium transition-colors",
                basePath === "/admin/ukt/arsip"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              📦 Arsip UKT
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              const href = buildUktAdminUrl(semester, year, null, {
                create: true,
                basePath: "/admin/ukt",
              });
              startTransition(() => {
                router.push(href);
              });
            }}
            className="inline-flex h-7 items-center rounded-md bg-inkai-red px-2.5 text-xs font-medium text-white transition-colors hover:bg-inkai-red/90"
          >
            + Buat Periode
          </button>
        </div>
      </div>
    </div>
  );
}
