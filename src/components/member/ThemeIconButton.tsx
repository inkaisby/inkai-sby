"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";

type ThemeMode = "system" | "light" | "dark";

function nextTheme(current: string | undefined): ThemeMode {
  if (current === "system") return "light";
  if (current === "light") return "dark";
  return "system";
}

function themeLabel(theme: string | undefined, resolved: string | undefined) {
  if (theme === "system") {
    return resolved === "dark"
      ? "Tema sistem (gelap) — ketuk untuk terang"
      : "Tema sistem (terang) — ketuk untuk terang manual";
  }
  if (theme === "light") return "Mode terang — ketuk untuk gelap";
  if (theme === "dark") return "Mode gelap — ketuk untuk ikuti sistem";
  return "Ganti tema";
}

export function ThemeIconButton({ className }: { className?: string }) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const mode = mounted ? ((theme ?? "system") as ThemeMode) : "system";
  const label = mounted ? themeLabel(mode, resolvedTheme) : "Tema";

  return (
    <button
      type="button"
      onClick={() => setTheme(nextTheme(mode))}
      className={
        className ??
        "flex h-10 w-10 items-center justify-center rounded-xl bg-muted/80 text-foreground transition-colors hover:bg-muted"
      }
      aria-label={label}
      title={label}
    >
      {!mounted || mode === "system" ? (
        <Monitor size={18} />
      ) : mode === "dark" ? (
        <Sun size={18} />
      ) : (
        <Moon size={18} />
      )}
    </button>
  );
}
