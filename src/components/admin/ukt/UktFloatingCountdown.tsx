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

function CompactUnit({
  value,
  label,
  emergency,
}: {
  value: string;
  label: string;
  emergency?: boolean;
}) {
  return (
    <span className="inline-flex flex-col items-center leading-none">
      <span
        className={cn(
          "font-mono text-sm font-semibold tabular-nums tracking-tight",
          emergency ? "text-inkai-red" : "text-foreground",
        )}
      >
        {value}
      </span>
      <span
        className={cn(
          "mt-0.5 text-[8px] font-medium uppercase tracking-wider",
          emergency ? "text-inkai-red/70" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
    </span>
  );
}

function CompactSep({ emergency }: { emergency?: boolean }) {
  return (
    <span
      className={cn(
        "mb-2.5 text-xs font-light",
        emergency ? "text-inkai-red/60" : "text-muted-foreground/50",
      )}
      aria-hidden
    >
      :
    </span>
  );
}

/** Timer kompak inline — ditempatkan di samping badge status. */
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
    <div
      className={cn(
        "inline-flex items-end gap-1 rounded-lg border px-2 py-1.5",
        emergency
          ? "ukt-timer-emergency border-inkai-red/40 bg-inkai-red/5"
          : "border-border/70 bg-muted/40",
        expired && "opacity-60",
        className,
      )}
      aria-live="polite"
      aria-atomic="true"
      title={expired ? "Pendaftaran ditutup" : emergency ? "H-2 · Darurat" : "Hitungan mundur"}
    >
      <CompactUnit
        value={pad(parts.days, parts.days >= 100 ? 3 : 2)}
        label="hr"
        emergency={emergency}
      />
      <CompactSep emergency={emergency} />
      <CompactUnit value={pad(parts.hours)} label="jm" emergency={emergency} />
      <CompactSep emergency={emergency} />
      <CompactUnit value={pad(parts.minutes)} label="mn" emergency={emergency} />
      <CompactSep emergency={emergency} />
      <CompactUnit value={pad(parts.seconds)} label="dt" emergency={emergency} />
      <CompactSep emergency={emergency} />
      <CompactUnit value={pad(parts.ms, 3)} label="ms" emergency={emergency} />
    </div>
  );
}
