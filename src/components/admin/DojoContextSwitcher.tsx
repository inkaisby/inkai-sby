"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

export type DojoContextOption = { id: string; name: string };

/**
 * Context switcher ranting untuk admin multi-dojo.
 * Menyimpan pilihan di query `dojoId` (kosong = semua).
 */
export function DojoContextSwitcher({
  dojos,
  value,
  label = "Kelola ranting",
  allowAll = true,
  allLabel = "Semua ranting",
  className,
}: {
  dojos: DojoContextOption[];
  value: string;
  label?: string;
  allowAll?: boolean;
  allLabel?: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  if (dojos.length <= 1) return null;

  function onChange(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next) params.set("dojoId", next);
    else params.delete("dojoId");
    params.delete("page");
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  return (
    <div className={className ?? "space-y-1"}>
      <label className="text-xs text-muted-foreground">{label}</label>
      <select
        value={value}
        disabled={pending}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 min-w-[180px] rounded-lg border border-inkai-red/30 bg-background px-2 text-sm font-medium text-foreground"
        aria-label={label}
      >
        {allowAll ? <option value="">{allLabel}</option> : null}
        {dojos.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
    </div>
  );
}
