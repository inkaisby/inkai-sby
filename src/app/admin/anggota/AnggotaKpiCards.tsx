"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Users,
  Clock,
  UserCheck,
  UserX,
  FileWarning,
  IdCard,
  UserMinus,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export type AnggotaKpiIconName =
  | "users"
  | "clock"
  | "userCheck"
  | "userMinus"
  | "userX"
  | "fileWarning"
  | "idCard";

export type AnggotaKpiItem = {
  key: string;
  label: string;
  value: number | string;
  href: string;
  active: boolean;
  accent?: string;
  hint?: string;
  /** Nama ikon serializable (jangan kirim komponen Lucide dari Server Component). */
  icon: AnggotaKpiIconName;
};

const KPI_ICONS: Record<AnggotaKpiIconName, LucideIcon> = {
  users: Users,
  clock: Clock,
  userCheck: UserCheck,
  userMinus: UserMinus,
  userX: UserX,
  fileWarning: FileWarning,
  idCard: IdCard,
};

/**
 * KPI cards: navigasi via startTransition agar tidak flash AdminLoading
 * dan ring aktif langsung (optimistic).
 */
export function AnggotaKpiCards({
  items,
  children,
  onNavigate,
}: {
  items: AnggotaKpiItem[];
  children?: ReactNode;
  /** Client-side navigate — hindari full RSC reload. */
  onNavigate?: (href: string, key: string) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [optimisticKey, setOptimisticKey] = useState<string | null>(null);

  useEffect(() => {
    setOptimisticKey(null);
  }, [items]);

  useEffect(() => {
    if (onNavigate) return;
    for (const item of items) {
      const qs = item.href.startsWith("?") ? item.href : `?${item.href}`;
      router.prefetch(`${pathname}${qs}`);
    }
  }, [items, pathname, router, onNavigate]);

  function go(href: string, key: string) {
    setOptimisticKey(key);
    if (onNavigate) {
      onNavigate(href, key);
      return;
    }
    const qs = href.startsWith("?") ? href : `?${href}`;
    startTransition(() => {
      router.replace(`${pathname}${qs}`, { scroll: false });
    });
  }

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {items.map((kpi) => {
          const Icon = KPI_ICONS[kpi.icon] ?? Users;
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
