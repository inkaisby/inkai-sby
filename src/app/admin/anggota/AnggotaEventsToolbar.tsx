"use client";

import { Trophy, Scale, Award, Users, Sparkles } from "lucide-react";
import type { ActiveRegistrationPeriod } from "@/lib/active-registration-periods";
import type { EventType } from "./AnggotaEventModal";
import { cn } from "@/lib/utils";

type Props = {
  activeUkt: ActiveRegistrationPeriod;
  activeLatber: ActiveRegistrationPeriod;
  activePertandingan: ActiveRegistrationPeriod;
  activeWasitJuri: ActiveRegistrationPeriod;
  selectedCount?: number;
  onSelectEvent: (type: EventType) => void;
};

export function AnggotaEventsToolbar({
  activeUkt,
  activeLatber,
  activePertandingan,
  activeWasitJuri,
  selectedCount = 0,
  onSelectEvent,
}: Props) {
  const events = [
    {
      type: "pertandingan" as const,
      label: "Kejuaraan",
      fullLabel: "Kejuaraan / Roster",
      icon: Trophy,
      active: Boolean(activePertandingan?.id),
      periodTitle: activePertandingan?.title,
    },
    {
      type: "wasit-juri" as const,
      label: "Wasit & Juri",
      fullLabel: "Sertifikasi Wasit Juri",
      icon: Scale,
      active: Boolean(activeWasitJuri?.id),
      periodTitle: activeWasitJuri?.title,
    },
    {
      type: "ukt" as const,
      label: "UKT",
      fullLabel: "Ujian Kenaikan Tingkat",
      icon: Award,
      active: Boolean(activeUkt?.id),
      periodTitle: activeUkt?.title,
    },
    {
      type: "latber" as const,
      label: "Latber",
      fullLabel: "Latihan Bersama",
      icon: Users,
      active: Boolean(activeLatber?.id),
      periodTitle: activeLatber?.title,
    },
  ];

  return (
    <div className="mb-4 rounded-lg border bg-card p-2 sm:p-2.5 shadow-xs">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap flex items-center gap-1.5 pl-1">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Events:
          </span>
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-1.5 flex-1">
            {events.map((ev) => {
              const Icon = ev.icon;
              return (
                <button
                  key={ev.type}
                  type="button"
                  onClick={() => onSelectEvent(ev.type)}
                  className={cn(
                    "inline-flex items-center justify-between sm:justify-start gap-2 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors text-left",
                    "hover:bg-muted/80 hover:border-foreground/20 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring",
                    ev.active
                      ? "bg-background border-border text-foreground"
                      : "bg-muted/30 border-dashed text-muted-foreground hover:text-foreground"
                  )}
                  title={ev.periodTitle || ev.fullLabel}
                >
                  <div className="flex items-center gap-1.5">
                    <Icon className={cn("h-3.5 w-3.5 shrink-0", ev.active ? "text-primary" : "text-muted-foreground")} />
                    <span className="truncate max-w-[100px] sm:max-w-none">{ev.label}</span>
                  </div>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 text-[10px] px-1.5 py-0.2 rounded-full font-normal shrink-0",
                      ev.active
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-medium"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full shrink-0",
                        ev.active ? "bg-emerald-600 animate-pulse" : "bg-muted-foreground/40"
                      )}
                    />
                    {ev.active ? "Buka" : "Tutup"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {selectedCount > 0 ? (
          <div className="flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/5 px-2.5 py-1 text-xs text-primary self-start sm:self-auto">
            <span className="font-semibold">{selectedCount}</span> anggota dipilih
            <span className="text-[11px] text-muted-foreground hidden lg:inline">
              (klik event untuk daftarkan)
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

