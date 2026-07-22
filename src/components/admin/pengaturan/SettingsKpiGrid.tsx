import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export type SettingsKpiItem = {
  label: string;
  value: number | string;
  hint?: string;
  icon?: LucideIcon;
};

export function SettingsKpiGrid({ items }: { items: SettingsKpiItem[] }) {
  return (
    <div
      className={`-mx-3 mb-4 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:mb-6 sm:grid sm:gap-3 sm:overflow-visible sm:px-0 ${
        items.length >= 4
          ? "sm:grid-cols-2 lg:grid-cols-4"
          : items.length === 3
            ? "sm:grid-cols-3"
            : "sm:grid-cols-2"
      }`}
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Card
            key={item.label}
            className="w-[9.5rem] shrink-0 sm:w-full sm:min-w-0"
          >
            <CardContent className="flex items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {item.label}
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{item.value}</p>
                {item.hint ? (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {item.hint}
                  </p>
                ) : null}
              </div>
              {Icon ? (
                <div className="rounded-lg bg-inkai-red/10 p-2 text-inkai-red">
                  <Icon className="h-4 w-4" />
                </div>
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
