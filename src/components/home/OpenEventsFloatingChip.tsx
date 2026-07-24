"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronRight, X } from "lucide-react";
import {
  formatRemainingShort,
  type PublicOpenEventSummary,
} from "@/lib/open-events";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "inkai-open-events-chip-dismissed";

type Props = {
  initialEvents: PublicOpenEventSummary[];
};

/**
 * Floating chip kegiatan terbuka/berlangsung di beranda publik.
 * HP: FAB ikon + count (kelas float agar tidak kena hide admin topbar).
 * Desktop: pill penuh.
 */
export function OpenEventsFloatingChip({ initialEvents }: Props) {
  const [events, setEvents] = useState(initialEvents);
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [ready, setReady] = useState(false);
  const [tick, setTick] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === "1") {
        setDismissed(true);
      }
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    setEvents(initialEvents);
  }, [initialEvents]);

  useEffect(() => {
    if (events.length === 0) return;
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, [events.length]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const enriched = useMemo(() => {
    void tick;
    const now = Date.now();
    return events.map((e) => ({
      ...e,
      remainingMs: e.registrationOpen
        ? Math.max(0, new Date(e.closesAt).getTime() - now)
        : e.remainingMs,
    }));
  }, [events, tick]);

  const count = enriched.length;

  if (!ready || dismissed || count === 0) return null;

  function dismiss() {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
    setOpen(false);
  }

  return (
    <div
      ref={containerRef}
      className="pointer-events-none fixed right-3 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-[60] sm:right-5 sm:bottom-5"
    >
      <div className="pointer-events-auto relative">
        {/* Mobile: FAB compact */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label={`Kegiatan masih terbuka: ${count}`}
          className={cn(
            "open-events-icon-btn relative flex h-12 w-12 items-center justify-center rounded-full border border-inkai-red/25 bg-background shadow-lg sm:hidden",
            open && "open-events-icon-btn--open",
          )}
        >
          <span className="open-events-live open-events-live--sm absolute top-1.5 left-1.5" aria-hidden>
            <span className="open-events-live-dot" />
          </span>
          <CalendarDays className="size-5 text-inkai-red" aria-hidden />
          <span className="open-events-count open-events-count--float">{count}</span>
        </button>

        {/* Desktop: pill */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label={`Kegiatan masih terbuka: ${count}`}
          className={cn(
            "open-events-chip open-events-chip--float hidden max-w-[min(92vw,320px)] items-center gap-2 shadow-lg sm:flex",
            open && "open-events-chip--open",
          )}
        >
          <span className="open-events-live" aria-hidden>
            <span className="open-events-live-dot" />
          </span>
          <span className="min-w-0 flex-1 text-left">
            <span className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold tracking-[0.12em] text-inkai-red uppercase">
                Masih terbuka
              </span>
              <span className="open-events-count">{count}</span>
            </span>
            <span className="block truncate text-xs font-semibold text-foreground">
              {enriched[0]?.title ?? "Kegiatan"}
            </span>
          </span>
          <ChevronRight
            className={cn(
              "size-3.5 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-90 text-inkai-red",
            )}
            aria-hidden
          />
        </button>

        {open ? (
          <>
            <button
              type="button"
              aria-label="Tutup"
              className="fixed inset-0 z-[55] bg-black/25 sm:bg-black/10"
              onClick={() => setOpen(false)}
            />
            <div
              role="dialog"
              aria-label="Kegiatan masih terbuka"
              className="open-events-panel absolute right-0 bottom-[calc(100%+0.5rem)] z-[65] w-[min(100vw-1.5rem,360px)] overflow-hidden"
            >
              <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                  <CalendarDays className="size-3.5" aria-hidden />
                  Kegiatan aktif
                </p>
                <div className="flex items-center gap-2">
                  <Link
                    href="/kegiatan"
                    prefetch
                    onClick={() => setOpen(false)}
                    className="text-[11px] font-medium text-inkai-red hover:underline"
                  >
                    Semua
                  </Link>
                  <button
                    type="button"
                    onClick={dismiss}
                    className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Sembunyikan untuk sesi ini"
                    title="Sembunyikan"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              </div>
              <ul className="max-h-[min(50vh,320px)] space-y-1 overflow-y-auto overscroll-contain">
                {enriched.map((e) => (
                  <li key={e.id}>
                    <Link
                      href={e.href}
                      prefetch
                      onClick={() => setOpen(false)}
                      className="open-events-row group/row flex items-start gap-2.5 rounded-xl px-2.5 py-2.5 transition-colors hover:bg-inkai-red/[0.06]"
                    >
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_0_3px] shadow-emerald-500/20" />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="line-clamp-2 text-sm font-semibold leading-snug group-hover/row:text-inkai-red">
                            {e.title}
                          </span>
                          {e.registrationOpen ? (
                            <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                              Masih terbuka
                            </span>
                          ) : null}
                          {e.ongoing ? (
                            <span className="rounded-md bg-inkai-yellow/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:text-inkai-yellow">
                              Berlangsung
                            </span>
                          ) : null}
                          {e.isUkt ? (
                            <span className="rounded-md bg-inkai-red/10 px-1.5 py-0.5 text-[10px] font-semibold text-inkai-red">
                              UKT
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-muted-foreground">
                          {e.registrationOpen
                            ? `Tutup ${formatRemainingShort(e.remainingMs)}`
                            : "Sedang berlangsung"}
                          {e.location ? ` · ${e.location}` : ""}
                        </span>
                      </span>
                      <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground/70" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
