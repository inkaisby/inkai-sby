"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, Timer } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  targetIso: string;
  label?: string;
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
  wide,
  emergency,
}: {
  value: string;
  label: string;
  wide?: boolean;
  emergency?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-0.5">
      <span
        className={cn(
          "font-mono text-lg font-semibold tabular-nums tracking-tight sm:text-xl",
          wide ? "min-w-[2.75rem]" : "min-w-[2rem]",
          emergency ? "text-inkai-red" : "text-foreground",
        )}
      >
        {value}
      </span>
      <span
        className={cn(
          "text-[9px] font-medium uppercase tracking-[0.14em]",
          emergency ? "text-inkai-red/70" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
    </div>
  );
}

function Separator({ emergency }: { emergency?: boolean }) {
  return (
    <span
      className={cn(
        "mb-3.5 self-center text-sm font-light",
        emergency ? "text-inkai-red/70" : "text-inkai-red/50",
      )}
      aria-hidden
    >
      :
    </span>
  );
}

export function UktFloatingCountdown({
  targetIso,
  label = "Batas pendaftaran",
  className,
}: Props) {
  const targetMs = new Date(targetIso).getTime();
  const [ready, setReady] = useState(false);
  const [expired, setExpired] = useState(false);
  const [minimized, setMinimized] = useState(false);
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
    const tick = () => {
      const next = calcRemaining(targetMs, Date.now());
      if (!next) {
        setParts({ days: 0, hours: 0, minutes: 0, seconds: 0, ms: 0, totalMs: 0 });
        if (!expiredRef.current) {
          expiredRef.current = true;
          setExpired(true);
        }
        return;
      }
      if (expiredRef.current) {
        expiredRef.current = false;
        setExpired(false);
      }
      setParts(next);
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [targetMs]);

  if (Number.isNaN(targetMs) || !ready) return null;

  const emergency = !expired && parts.totalMs > 0 && parts.totalMs <= H2_MS;

  return (
    <aside
      className={cn(
        "pointer-events-auto fixed top-20 right-4 z-40 w-[min(100%-1.5rem,22rem)] sm:top-24 sm:right-6",
        className,
      )}
      aria-live="polite"
      aria-atomic="true"
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border shadow-xl shadow-black/10",
          "bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70",
          emergency
            ? "ukt-timer-emergency border-inkai-red/50 ring-2 ring-inkai-red/30"
            : "border-border/60 ring-1 ring-inkai-red/10 dark:ring-inkai-red/20",
        )}
      >
        {/* Strip atas: tipis biasa; H-2 = h-2 + denyut emergency */}
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0",
            emergency
              ? "ukt-timer-emergency-bar h-2 bg-gradient-to-r from-inkai-red via-inkai-yellow to-inkai-red"
              : "h-px bg-gradient-to-r from-transparent via-inkai-red/60 to-transparent",
          )}
        />

        <div
          className={cn(
            "flex items-center justify-between gap-2 px-3.5 pb-1",
            emergency ? "pt-4" : "pt-3",
          )}
        >
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                expired
                  ? "bg-muted text-muted-foreground"
                  : emergency
                    ? "ukt-timer-emergency-icon bg-inkai-red text-white"
                    : "bg-inkai-red/10 text-inkai-red",
              )}
            >
              {emergency ? (
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <Timer className="h-3.5 w-3.5" aria-hidden />
              )}
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold tracking-wide text-foreground">
                {label}
              </p>
              <p
                className={cn(
                  "text-[10px] font-medium uppercase tracking-[0.12em]",
                  expired ? "text-muted-foreground" : "text-inkai-red",
                )}
              >
                {expired ? "Sudah ditutup" : emergency ? "H-2 · Darurat" : "Hitungan mundur"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMinimized((v) => !v)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={minimized ? "Perbesar timer" : "Ciutkan timer"}
          >
            {minimized ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        </div>

        {!minimized && (
          <div className="px-3.5 pb-3.5 pt-2">
            <div
              className={cn(
                "flex items-end justify-between gap-1 rounded-xl px-2.5 py-2.5 sm:gap-1.5",
                emergency
                  ? "bg-gradient-to-br from-inkai-red/15 via-background/50 to-inkai-red/10"
                  : "bg-gradient-to-br from-muted/50 via-background/40 to-inkai-red/[0.04]",
                expired && "opacity-60",
              )}
            >
              <Unit
                value={pad(parts.days, parts.days >= 100 ? 3 : 2)}
                label="Hari"
                wide
                emergency={emergency}
              />
              <Separator emergency={emergency} />
              <Unit value={pad(parts.hours)} label="Jam" emergency={emergency} />
              <Separator emergency={emergency} />
              <Unit value={pad(parts.minutes)} label="Menit" emergency={emergency} />
              <Separator emergency={emergency} />
              <Unit value={pad(parts.seconds)} label="Detik" emergency={emergency} />
              <Separator emergency={emergency} />
              <Unit value={pad(parts.ms, 3)} label="ms" wide emergency={emergency} />
            </div>
          </div>
        )}

        {minimized && !expired && (
          <div className="px-3.5 pb-3">
            <p
              className={cn(
                "font-mono text-sm font-semibold tabular-nums tracking-tight",
                emergency ? "text-inkai-red" : "text-foreground",
              )}
            >
              {pad(parts.days)}:{pad(parts.hours)}:{pad(parts.minutes)}:
              {pad(parts.seconds)}.
              <span className="text-inkai-red">{pad(parts.ms, 3)}</span>
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
