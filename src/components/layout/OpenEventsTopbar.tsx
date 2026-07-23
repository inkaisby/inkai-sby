"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronRight } from "lucide-react";
import {
  formatRemainingShort,
  type OpenEventSummary,
} from "@/lib/open-events";
import { useNavigation } from "@/components/layout/NavigationProvider";
import { cn } from "@/lib/utils";

type ApiResponse = {
  count: number;
  events: OpenEventSummary[];
};

/**
 * Chip kegiatan terbuka.
 * HP: ikon compact di cluster aksi (tidak mencuri ruang judul).
 * Desktop: pill penuh dengan rotasi judul.
 */
export function OpenEventsTopbar() {
  const { startNavigation } = useNavigation();
  const [events, setEvents] = useState<OpenEventSummary[]>([]);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [tick, setTick] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchOpen = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/open-events");
      if (!res.ok) return;
      const data = (await res.json()) as ApiResponse;
      setEvents(Array.isArray(data.events) ? data.events : []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void fetchOpen();
    const interval = setInterval(() => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "hidden"
      ) {
        return;
      }
      void fetchOpen();
    }, 90_000);
    return () => clearInterval(interval);
  }, [fetchOpen]);

  useEffect(() => {
    if (events.length <= 1) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % events.length);
    }, 3800);
    return () => clearInterval(id);
  }, [events.length]);

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

  const current = events[index % Math.max(events.length, 1)];
  const count = events.length;

  const enriched = useMemo(() => {
    void tick;
    const now = Date.now();
    return events.map((e) => ({
      ...e,
      remainingMs: Math.max(0, new Date(e.closesAt).getTime() - now),
    }));
  }, [events, tick]);

  if (count === 0) {
    return (
      <div
        className="open-events-chip open-events-chip--idle hidden items-center gap-1.5 sm:flex"
        title="Tidak ada kegiatan dengan pendaftaran terbuka"
      >
        <CalendarDays className="size-3.5 shrink-0 opacity-60" aria-hidden />
        <span className="whitespace-nowrap text-xs font-medium text-muted-foreground">
          Tidak ada kegiatan terbuka
        </span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative shrink-0">
      {/* Mobile: ikon saja */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Kegiatan masih terbuka: ${count}`}
        className={cn(
          "open-events-icon-btn relative flex h-9 w-9 items-center justify-center rounded-xl sm:hidden",
          open && "open-events-icon-btn--open",
        )}
      >
        <span className="open-events-live open-events-live--sm absolute top-1 left-1" aria-hidden>
          <span className="open-events-live-dot" />
        </span>
        <CalendarDays className="size-4 text-inkai-red" aria-hidden />
        <span className="open-events-count open-events-count--float">{count}</span>
      </button>

      {/* Desktop: chip penuh */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn(
          "open-events-chip group hidden max-w-[min(42vw,380px)] items-center gap-2 text-left sm:flex",
          open && "open-events-chip--open",
        )}
      >
        <span className="open-events-live" aria-hidden>
          <span className="open-events-live-dot" />
        </span>
        <span className="min-w-0 flex-1 flex-col">
          <span className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold tracking-[0.12em] text-inkai-red uppercase">
              Masih terbuka
            </span>
            <span className="open-events-count">{count}</span>
          </span>
          <span className="open-events-marquee relative h-4 overflow-hidden">
            <span
              key={current?.id ?? index}
              className="open-events-marquee-item absolute inset-x-0 top-0 truncate text-xs font-semibold text-foreground"
            >
              {current?.title ?? "Kegiatan"}
            </span>
          </span>
        </span>
        <ChevronRight
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform duration-300",
            open && "rotate-90 text-inkai-red",
          )}
          aria-hidden
        />
      </button>

      {open ? (
        <>
          {/* Backdrop HP agar fokus panel */}
          <button
            type="button"
            aria-label="Tutup"
            className="fixed inset-0 z-40 bg-black/25 sm:hidden"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-label="Kegiatan masih terbuka"
            className="open-events-panel fixed top-14 right-3 left-3 z-50 max-h-[min(70vh,420px)] overflow-hidden sm:absolute sm:top-[calc(100%+0.5rem)] sm:right-0 sm:left-auto sm:w-[min(100vw-2rem,360px)]"
          >
            <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
              <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase sm:text-xs">
                Pendaftaran masih terbuka
              </p>
              <Link
                href="/admin/kegiatan"
                prefetch
                onClick={() => {
                  setOpen(false);
                  startNavigation("/admin/kegiatan");
                }}
                className="shrink-0 text-[11px] font-medium text-inkai-red hover:underline"
              >
                Semua
              </Link>
            </div>
            <ul className="max-h-[min(55vh,340px)] space-y-1 overflow-y-auto overscroll-contain pr-0.5">
              {enriched.map((e) => (
                <li key={e.id}>
                  <Link
                    href={e.href}
                    prefetch
                    onClick={() => {
                      setOpen(false);
                      startNavigation(e.href);
                    }}
                    className="open-events-row group/row flex items-start gap-2.5 rounded-xl px-2.5 py-2.5 transition-colors hover:bg-inkai-red/[0.06] active:bg-inkai-red/[0.08]"
                  >
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_0_3px] shadow-emerald-500/20" />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="line-clamp-2 text-sm font-semibold leading-snug text-foreground group-hover/row:text-inkai-red">
                          {e.title}
                        </span>
                        {e.isUkt ? (
                          <span className="rounded-md bg-inkai-red/10 px-1.5 py-0.5 text-[10px] font-semibold text-inkai-red">
                            UKT
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-muted-foreground">
                        Tutup {formatRemainingShort(e.remainingMs)}
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
  );
}
