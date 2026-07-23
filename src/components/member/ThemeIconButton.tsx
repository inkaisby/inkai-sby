"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Clock, Moon, Sun } from "lucide-react";
import {
  nextThemeMode,
  normalizeThemeMode,
  resolveAppearance,
  themeModeLabel,
} from "@/lib/theme-schedule";

export function ThemeIconButton({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (normalizeThemeMode(theme) !== "schedule") return;
    const id = window.setInterval(() => setTick((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, [theme]);

  const mode = mounted ? normalizeThemeMode(theme) : "schedule";
  const appearance = mounted ? resolveAppearance(theme) : "light";
  void tick;
  const label = mounted ? themeModeLabel(mode, appearance) : "Tema";

  return (
    <button
      type="button"
      onClick={() => setTheme(nextThemeMode(mode))}
      className={
        className ??
        "flex h-10 w-10 items-center justify-center rounded-xl bg-muted/80 text-foreground transition-colors hover:bg-muted"
      }
      aria-label={label}
      title={label}
    >
      {!mounted || mode === "schedule" ? (
        <Clock size={18} />
      ) : mode === "dark" ? (
        <Sun size={18} />
      ) : (
        <Moon size={18} />
      )}
    </button>
  );
}
