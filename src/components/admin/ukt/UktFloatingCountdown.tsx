"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  targetIso: string;
  className?: string;
};

type Remaining = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  ms: number;
  totalMs: number;
};

/** Ambang H-2: sisa ≤ 48 jam. */
const H2_MS = 48 * 60 * 60 * 1000;

function pad(n: number, len = 2) {
  return String(Math.max(0, n)).padStart(len, "0");
}

function calcRemaining(targetMs: number, nowMs: number): Remaining | null {
  const diff = targetMs - nowMs;
  if (diff <= 0) return null;
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff % 86_400_000) / 3_600_000),
    minutes: Math.floor((diff % 3_600_000) / 60_000),
    seconds: Math.floor((diff % 60_000) / 1_000),
    ms: Math.floor(diff % 1_000),
    totalMs: diff,
  };
}

function Unit({
  value,
  label,
  emergency,
  wide,
}: {
  value: string;
  label: string;
  emergency?: boolean;
  wide?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-0.5 sm:gap-1">
      <span
        className={cn(
          "rounded-md bg-background/80 px-1.5 py-1 font-mono text-lg font-semibold tabular-nums tracking-tight shadow-sm ring-1 ring-black/[0.04] sm:rounded-lg sm:px-2.5 sm:py-1.5 sm:text-3xl",
          wide
            ? "min-w-[2.5rem] sm:min-w-[3.25rem]"
            : "min-w-[2rem] sm:min-w-[2.75rem]",
          emergency ? "text-inkai-red ring-inkai-red/20" : "text-foreground",
        )}
      >
        {value}
      </span>
      <span
        className={cn(
          "text-[9px] font-medium uppercase tracking-[0.14em] sm:text-[10px] sm:tracking-[0.16em]",
          emergency ? "text-inkai-red/70" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
    </div>
  );
}

function Sep({ emergency }: { emergency?: boolean }) {
  return (
    <span
      className={cn(
        "mb-4 self-center text-base font-light sm:mb-5 sm:text-xl",
        emergency ? "text-inkai-red/50" : "text-muted-foreground/40",
      )}
      aria-hidden
    >
      :
    </span>
  );
}

/**
 * Timer batas pendaftaran — hari/jam/menit/detik/ms via rAF.
 * Pause saat tab tersembunyi agar tidak membebani HP.
 */
export function UktFloatingCountdown({ targetIso, className }: Props) {
  const targetMs = new Date(targetIso).getTime();
  const [ready, setReady] = useState(false);
  const [expired, setExpired] = useState(false);
  const [parts, setParts] = useState<Remaining>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    ms: 0,
    totalMs: 0,
  });
  const expiredRef = useRef(false);

  useEffect(() => {
    if (Number.isNaN(targetMs)) {
      setReady(true);
      setExpired(true);
      return;
    }

    setReady(true);
    let raf = 0;
    let running = false;

    const stop = () => {
      running = false;
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };

    const tick = () => {
      if (!running) return;
      const next = calcRemaining(targetMs, Date.now());
      if (!next) {
        setParts({
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
          ms: 0,
          totalMs: 0,
        });
        if (!expiredRef.current) {
          expiredRef.current = true;
          setExpired(true);
        }
        stop();
        return;
      }
      if (expiredRef.current) {
        expiredRef.current = false;
        setExpired(false);
      }
      setParts(next);
      raf = requestAnimationFrame(tick);
    };

    const start = () => {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(tick);
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        stop();
        return;
      }
      start();
    };

    if (document.visibilityState !== "hidden") start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [targetMs]);

  if (Number.isNaN(targetMs) || !ready) return null;

  const emergency = !expired && parts.totalMs > 0 && parts.totalMs <= H2_MS;

  return (
    <div
      className={cn(
        "relative w-full min-w-0 overflow-hidden rounded-xl border px-3 py-2.5 sm:flex-1 sm:px-4 sm:py-3",
        emergency
          ? "ukt-timer-emergency border-inkai-red/40 bg-gradient-to-br from-inkai-red/10 via-background to-inkai-red/[0.06]"
          : "border-border/50 bg-gradient-to-br from-background via-muted/30 to-inkai-red/[0.03]",
        expired && "opacity-60",
        className,
      )}
      aria-live="polite"
      aria-atomic="true"
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-0.5",
          emergency
            ? "ukt-timer-emergency-bar bg-gradient-to-r from-inkai-red via-inkai-yellow to-inkai-red"
            : "bg-gradient-to-r from-transparent via-inkai-red/40 to-transparent",
        )}
      />

      <p
        className={cn(
          "mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] sm:mb-2.5",
          expired
            ? "text-muted-foreground"
            : emergency
              ? "text-inkai-red"
              : "text-muted-foreground",
        )}
      >
        {expired
          ? "Pendaftaran ditutup"
          : emergency
            ? "H-2 · Batas hampir tutup"
            : "Batas pendaftaran"}
      </p>

      <div className="flex flex-wrap items-end justify-center gap-1 sm:gap-2.5">
        <Unit
          value={pad(parts.days, parts.days >= 100 ? 3 : 2)}
          label="Hari"
          wide
          emergency={emergency}
        />
        <Sep emergency={emergency} />
        <Unit value={pad(parts.hours)} label="Jam" emergency={emergency} />
        <Sep emergency={emergency} />
        <Unit value={pad(parts.minutes)} label="Menit" emergency={emergency} />
        <Sep emergency={emergency} />
        <Unit value={pad(parts.seconds)} label="Detik" emergency={emergency} />
        <Sep emergency={emergency} />
        <Unit
          value={pad(parts.ms, 3)}
          label="ms"
          wide
          emergency={emergency}
        />
      </div>
    </div>
  );
}
