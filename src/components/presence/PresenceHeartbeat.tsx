"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import {
  HEARTBEAT_INTERVAL_HIDDEN_MS,
  HEARTBEAT_INTERVAL_VISIBLE_MS,
} from "@/lib/presence-constants";

async function sendHeartbeat() {
  try {
    await fetch("/api/presence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
    });
  } catch {
    // Silent — jangan ganggu UX
  }
}

/**
 * Kirim heartbeat saat user login (admin & anggota).
 * Pakai Page Visibility: interval lebih jarang saat tab hidden.
 */
export function PresenceHeartbeat() {
  const { status } = useSession();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;

    let cancelled = false;

    const schedule = () => {
      if (cancelled) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      const hidden =
        typeof document !== "undefined" && document.visibilityState === "hidden";
      const delay = hidden
        ? HEARTBEAT_INTERVAL_HIDDEN_MS
        : HEARTBEAT_INTERVAL_VISIBLE_MS;
      timerRef.current = setTimeout(async () => {
        if (cancelled) return;
        await sendHeartbeat();
        schedule();
      }, delay);
    };

    void sendHeartbeat().then(schedule);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void sendHeartbeat();
      }
      schedule();
    };

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [status]);

  return null;
}

/** Panggil sebelum signOut / ganti akun. */
export async function clearPresenceBeforeLogout() {
  try {
    await fetch("/api/presence", { method: "DELETE", keepalive: true });
  } catch {
    // ignore — server signOut event juga membersihkan
  }
}
