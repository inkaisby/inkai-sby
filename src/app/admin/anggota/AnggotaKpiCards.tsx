"use client";

import {
  useEffect,
  useState,
  useTransition,
  type ComponentType,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";

export type AnggotaKpiItem = {
  key: string;
  label: string;
  value: number | string;
  href: string;
  active: boolean;
  accent?: string;
  hint?: string;
  icon: ComponentType<{ className?: string }>;
};

/**
 * KPI cards: navigasi via startTransition agar tidak flash AdminLoading
 * dan ring aktif langsung (optimistic).
 */
export function AnggotaKpiCards({
  items,
  children,
}: {
  items: AnggotaKpiItem[];
  children?: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [optimisticKey, setOptimisticKey] = useState<string | null>(null);

  useEffect(() => {
    setOptimisticKey(null);
  }, [items]);

  useEffect(() => {
    for (const item of items) {
      const qs = item.href.startsWith("?") ? item.href : `?${item.href}`;
      router.prefetch(`${pathname}${qs}`);
    }
  }, [items, pathname, router]);

  function go(href: string, key: string) {
    setOptimisticKey(key);
    const qs = href.startsWith("?") ? href : `?${href}`;
    startTransition(() => {
      router.replace(`${pathname}${qs}`, { scroll: false });
    });
  }

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {items.map((kpi) => {
          const Icon = kpi.icon;
          const active =
            optimisticKey != null ? optimisticKey === kpi.key : kpi.active;
          return (
            <button
              key={kpi.key}
              type="button"
              onClick={() => go(kpi.href, kpi.key)}
              className="block w-full text-left"
            >
              <Card
                className={`transition-all hover:shadow-md hover:ring-1 hover:ring-inkai-red/30 ${
                  active ? "ring-2 ring-inkai-red" : ""
                } ${isPending && active ? "opacity-80" : ""}`}
              >
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <Icon
                      className={`h-4 w-4 ${kpi.accent ? kpi.accent : "text-inkai-red"}`}
                    />
                    <span className="text-lg font-bold tabular-nums">
                      {kpi.value}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {kpi.label}
                    {kpi.hint ? (
                      <span className="block opacity-70">{kpi.hint}</span>
                    ) : null}
                  </p>
                </CardContent>
              </Card>
            </button>
          );
        })}
      </div>
      {children ? (
        <div
          className={
            isPending
              ? "opacity-60 transition-opacity duration-150 pointer-events-none"
              : "transition-opacity duration-150"
          }
          aria-busy={isPending}
        >
          {children}
        </div>
      ) : null}
    </>
  );
}
