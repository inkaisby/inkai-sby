"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

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

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="size-8" aria-label="Tema">
        <Monitor className="size-4" />
      </Button>
    );
  }

  const mode = (theme ?? "system") as ThemeMode;
  const label = themeLabel(mode, resolvedTheme);

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-8"
      aria-label={label}
      title={label}
      onClick={() => setTheme(nextTheme(mode))}
    >
      {mode === "system" ? (
        <Monitor className="size-4" />
      ) : mode === "dark" ? (
        <Sun className="size-4" />
      ) : (
        <Moon className="size-4" />
      )}
    </Button>
  );
}
