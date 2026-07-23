"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, Check, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { extractDojoLabelFromNotificationText } from "@/lib/notification-display";

type NotificationItem = {
  id: string;
  title: string;
  content: string;
  type: string;
  isRead: boolean;
  createdAt: string;
};

const POLL_MS = 180_000;

export function NotificationBell({
  viewAllHref,
}: {
  viewAllHref: string;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemsLoadedRef = useRef(false);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?countOnly=1");
      if (!res.ok) return;
      const data = await res.json();
      setUnreadCount(data.unreadCount || 0);
    } catch {
      /* ignore */
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
      itemsLoadedRef.current = true;
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void fetchUnreadCount();
    const interval = setInterval(() => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "hidden"
      ) {
        return;
      }
      void fetchUnreadCount();
    }, POLL_MS);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  async function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next) {
      setLoading(true);
      await fetchNotifications();
      setLoading(false);
    }
  }

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: true }),
    });
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  }

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}`, { method: "PATCH" });
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  }

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="relative size-9"
        aria-label="Notifikasi"
        onClick={() => void toggleOpen()}
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-inkai-red px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(100vw-2rem,22rem)] rounded-xl border bg-popover text-popover-foreground shadow-lg">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <p className="text-sm font-semibold">Notifikasi</p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="flex items-center gap-1 text-xs text-inkai-red hover:underline"
              >
                <Check className="size-3" />
                Tandai dibaca
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading && !itemsLoadedRef.current ? (
              <p className="p-4 text-center text-sm text-muted-foreground">
                Memuat...
              </p>
            ) : items.length === 0 ? (
              <p className="p-4 text-center text-sm text-muted-foreground">
                Belum ada notifikasi.
              </p>
            ) : (
              items.slice(0, 8).map((n) => {
                const ranting = extractDojoLabelFromNotificationText(
                  `${n.title} ${n.content}`,
                );
                return (
                  <button
                    key={n.id}
                    type="button"
                    className={`w-full border-b px-4 py-3 text-left transition-colors hover:bg-muted/50 ${
                      !n.isRead ? "bg-inkai-red/5" : ""
                    }`}
                    onClick={() => {
                      if (!n.isRead) void markRead(n.id);
                    }}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="text-sm font-medium leading-tight">
                        {n.title}
                      </p>
                      {!n.isRead && (
                        <Badge className="h-5 shrink-0 bg-inkai-red text-[10px] text-white">
                          Baru
                        </Badge>
                      )}
                    </div>
                    {ranting ? (
                      <Badge
                        variant="outline"
                        className="mb-1 h-5 max-w-full truncate text-[10px] font-normal"
                      >
                        {ranting}
                      </Badge>
                    ) : null}
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {n.content}
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {new Date(n.createdAt).toLocaleString("id-ID")}
                    </p>
                  </button>
                );
              })
            )}
          </div>

          <div className="border-t p-2">
            <Link
              href={viewAllHref}
              className="flex items-center justify-center gap-1 rounded-lg py-2 text-xs font-medium text-inkai-red hover:bg-muted"
              onClick={() => setOpen(false)}
            >
              Lihat semua notifikasi
              <ExternalLink className="size-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
