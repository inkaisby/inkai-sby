"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

const STORAGE_KEY = "tanya-inkai-fab-pos";
const OPENED_KEY = "tanya-inkai-opened";
const DRAG_THRESHOLD_PX = 6;

export type FabPos = { x: number; y: number };

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function defaultPos(pathname: string): FabPos {
  const margin = 16;
  const fab = 56;
  const vw = typeof window !== "undefined" ? window.innerWidth : 390;
  const vh = typeof window !== "undefined" ? window.innerHeight : 844;
  const bottomExtra = pathname.startsWith("/dashboard") ? 80 : 16;
  return {
    x: Math.max(margin, vw - fab - margin),
    y: Math.max(margin, vh - fab - bottomExtra - margin),
  };
}

function clampPos(pos: FabPos, size = 56): FabPos {
  const margin = 8;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return {
    x: Math.min(Math.max(margin, pos.x), Math.max(margin, vw - size - margin)),
    y: Math.min(Math.max(margin, pos.y), Math.max(margin, vh - size - margin)),
  };
}

function readStoredPos(): FabPos | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FabPos;
    if (
      typeof parsed?.x === "number" &&
      typeof parsed?.y === "number" &&
      Number.isFinite(parsed.x) &&
      Number.isFinite(parsed.y)
    ) {
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function writeStoredPos(pos: FabPos) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
  } catch {
    /* ignore */
  }
}

export function hasOpenedTanyaInkai(): boolean {
  try {
    return localStorage.getItem(OPENED_KEY) === "1";
  } catch {
    return false;
  }
}

export function markOpenedTanyaInkai() {
  try {
    localStorage.setItem(OPENED_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function useDraggableFab(pathname: string) {
  const [pos, setPos] = useState<FabPos>(() => defaultPos(pathname));
  const [ready, setReady] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{
    active: boolean;
    moved: boolean;
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    lastX: number;
    lastY: number;
    lastT: number;
    vx: number;
    vy: number;
  } | null>(null);
  const posRef = useRef(pos);
  posRef.current = pos;
  const inertiaRef = useRef<number | null>(null);

  const stopInertia = useCallback(() => {
    if (inertiaRef.current != null) {
      cancelAnimationFrame(inertiaRef.current);
      inertiaRef.current = null;
    }
  }, []);

  const applyClampPersist = useCallback((next: FabPos) => {
    const clamped = clampPos(next);
    setPos(clamped);
    writeStoredPos(clamped);
    return clamped;
  }, []);

  useEffect(() => {
    const stored = readStoredPos();
    setPos(clampPos(stored ?? defaultPos(pathname)));
    setReady(true);
  }, [pathname]);

  useEffect(() => {
    const onResize = () => {
      setPos((current) => {
        const clamped = clampPos(current);
        writeStoredPos(clamped);
        return clamped;
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => () => stopInertia(), [stopInertia]);

  const runInertia = useCallback(
    (vx: number, vy: number) => {
      if (prefersReducedMotion()) {
        applyClampPersist(posRef.current);
        return;
      }
      stopInertia();
      let cx = posRef.current.x;
      let cy = posRef.current.y;
      let svx = vx;
      let svy = vy;
      const step = () => {
        svx *= 0.92;
        svy *= 0.92;
        cx += svx * 16;
        cy += svy * 16;
        const clamped = clampPos({ x: cx, y: cy });
        cx = clamped.x;
        cy = clamped.y;
        setPos(clamped);
        if (Math.hypot(svx, svy) < 0.02) {
          writeStoredPos(clamped);
          inertiaRef.current = null;
          return;
        }
        inertiaRef.current = requestAnimationFrame(step);
      };
      inertiaRef.current = requestAnimationFrame(step);
    },
    [applyClampPersist, stopInertia],
  );

  const onPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      stopInertia();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      dragRef.current = {
        active: true,
        moved: false,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        originX: posRef.current.x,
        originY: posRef.current.y,
        lastX: e.clientX,
        lastY: e.clientY,
        lastT: performance.now(),
        vx: 0,
        vy: 0,
      };
      setDragging(true);
    },
    [stopInertia],
  );

  const onPointerMove = useCallback((e: ReactPointerEvent) => {
    const d = dragRef.current;
    if (!d?.active || d.pointerId !== e.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
    d.moved = true;
    const now = performance.now();
    const dt = Math.max(1, now - d.lastT);
    d.vx = (e.clientX - d.lastX) / dt;
    d.vy = (e.clientY - d.lastY) / dt;
    d.lastX = e.clientX;
    d.lastY = e.clientY;
    d.lastT = now;
    setPos(clampPos({ x: d.originX + dx, y: d.originY + dy }));
  }, []);

  const onPointerUp = useCallback(
    (e: ReactPointerEvent): boolean => {
      const d = dragRef.current;
      if (!d?.active || d.pointerId !== e.pointerId) return false;
      d.active = false;
      setDragging(false);
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      const wasDrag = d.moved;
      if (wasDrag) {
        runInertia(d.vx, d.vy);
      } else {
        applyClampPersist(posRef.current);
      }
      dragRef.current = null;
      return wasDrag;
    },
    [applyClampPersist, runInertia],
  );

  return {
    pos,
    ready,
    dragging,
    onPointerDown,
    onPointerMove,
    onPointerUp,
  };
}
