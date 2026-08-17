"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  targetIso: string;
  className?: string;
  /** Versi ringkas untuk sticky bar publik HP — tanpa ms, font lebih kecil. */
  compact?: boolean;
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
  valueRef,
  compact,
}: {
  value: string;
  label: string;
  emergency?: boolean;
  wide?: boolean;
  valueRef?: React.RefObject<HTMLSpanElement | null>;
  compact?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-0.5 sm:gap-1">
      <span
        ref={valueRef}
        className={cn(
          "rounded-md bg-background/80 font-mono font-semibold tabular-nums tracking-tight shadow-sm ring-1 ring-black/[0.04]",
          compact
            ? "px-1 py-0.5 text-sm min-w-[1.75rem]"
            : "px-1.5 py-1 text-lg sm:rounded-lg sm:px-2.5 sm:py-1.5 sm:text-3xl",
          !compact &&
            (wide
              ? "min-w-[2.5rem] sm:min-w-[3.25rem]"
              : "min-w-[2rem] sm:min-w-[2.75rem]"),
          emergency ? "text-inkai-red ring-inkai-red/20" : "text-foreground",
        )}
      >
        {value}
      </span>
      <span
        className={cn(
          "font-medium uppercase tracking-[0.14em]",
          compact
            ? "text-[8px] tracking-[0.12em]"
            : "text-[9px] sm:text-[10px] sm:tracking-[0.16em]",
          emergency ? "text-inkai-red/70" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
    </div>
  );
}

function Sep({
  emergency,
  compact,
}: {
  emergency?: boolean;
  compact?: boolean;
}) {
  return (
    <span
      className={cn(
        "self-center font-light",
        compact ? "mb-3 text-sm" : "mb-4 text-base sm:mb-5 sm:text-xl",
        emergency ? "text-inkai-red/50" : "text-muted-foreground/40",
      )}
      aria-hidden
    >
      :
    </span>
  );
}

/**
 * Timer batas pendaftaran — hari–detik via React state (~1 Hz),
 * milidetik via DOM ref (tanpa setState per frame).
 */
export function UktFloatingCountdown({
  targetIso,
  className,
  compact = false,
}: Props) {
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
  const msRef = useRef<HTMLSpanElement>(null);
  const lastSecondRef = useRef<number | null>(null);
  const lastEmergencyRef = useRef(false);

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
        if (msRef.current) msRef.current.textContent = "000";
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

      if (msRef.current) {
        msRef.current.textContent = pad(next.ms, 3);
      }

      const emergency = next.totalMs <= H2_MS;
      const secondChanged = lastSecondRef.current !== next.seconds;
      const emergencyChanged = lastEmergencyRef.current !== emergency;

      if (secondChanged || emergencyChanged || lastSecondRef.current === null) {
        lastSecondRef.current = next.seconds;
        lastEmergencyRef.current = emergency;
        setParts(next);
      }

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

  const title = expired
    ? "Pendaftaran ditutup"
    : emergency
      ? "H-2 · Batas hampir tutup"
      : "Batas pendaftaran";

  return (
    <div
      className={cn(
        "relative w-full min-w-0 overflow-hidden rounded-xl border",
        compact ? "px-2 py-1.5 sm:px-3 sm:py-2" : "px-3 py-2.5 sm:flex-1 sm:px-4 sm:py-3",
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
          "font-semibold uppercase tracking-[0.18em]",
          compact
            ? "mb-1 text-[9px] tracking-[0.14em]"
            : "mb-1.5 text-[10px] sm:mb-2.5",
          expired
            ? "text-muted-foreground"
            : emergency
              ? "text-inkai-red"
              : "text-muted-foreground",
        )}
      >
        {title}
      </p>

      <div
        className={cn(
          "flex flex-wrap items-end justify-center",
          compact ? "gap-0.5" : "gap-1 sm:gap-2.5",
        )}
      >
        <Unit
          value={pad(parts.days, parts.days >= 100 ? 3 : 2)}
          label="Hari"
          wide
          emergency={emergency}
          compact={compact}
        />
        <Sep emergency={emergency} compact={compact} />
        <Unit
          value={pad(parts.hours)}
          label="Jam"
          emergency={emergency}
          compact={compact}
        />
        <Sep emergency={emergency} compact={compact} />
        <Unit
          value={pad(parts.minutes)}
          label="Menit"
          emergency={emergency}
          compact={compact}
        />
        <Sep emergency={emergency} compact={compact} />
        <Unit
          value={pad(parts.seconds)}
          label="Detik"
          emergency={emergency}
          compact={compact}
        />
        {!compact ? (
          <>
            <Sep emergency={emergency} compact={compact} />
            <Unit
              value={pad(parts.ms, 3)}
              label="ms"
              wide
              emergency={emergency}
              valueRef={msRef}
              compact={compact}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
