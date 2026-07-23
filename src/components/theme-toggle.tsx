"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Clock, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  nextThemeMode,
  normalizeThemeMode,
  resolveAppearance,
  themeModeLabel,
} from "@/lib/theme-schedule";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => setMounted(true), []);

  // Perbarui ikon/label saat jadwal ganti siang↔malam
  useEffect(() => {
    if (normalizeThemeMode(theme) !== "schedule") return;
    const id = window.setInterval(() => setTick((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, [theme]);

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="size-8" aria-label="Tema">
        <Clock className="size-4" />
      </Button>
    );
  }

  const mode = normalizeThemeMode(theme);
  const appearance = resolveAppearance(theme);
  void tick;
  const label = themeModeLabel(mode, appearance);

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-8"
      aria-label={label}
      title={label}
      onClick={() => setTheme(nextThemeMode(mode))}
    >
      {mode === "schedule" ? (
        <Clock className="size-4" />
      ) : mode === "dark" ? (
        <Sun className="size-4" />
      ) : (
        <Moon className="size-4" />
      )}
    </Button>
  );
}
