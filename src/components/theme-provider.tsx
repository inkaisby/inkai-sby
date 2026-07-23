"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import {
  THEME_STORAGE_KEY,
  getOperationalTheme,
  normalizeThemeMode,
} from "@/lib/theme-schedule";

/** Saat mode jadwal: terapkan light/dark sesuai jam, cek tiap menit. */
function ScheduleThemeSync() {
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    if (theme === "system") {
      setTheme("schedule");
    }
  }, [theme, setTheme]);

  useEffect(() => {
    const mode = normalizeThemeMode(theme);
    if (mode !== "schedule") return;

    const apply = () => {
      const appearance = getOperationalTheme();
      const root = document.documentElement;
      root.classList.remove("light", "dark", "schedule", "system");
      root.classList.add(appearance);
      root.style.colorScheme = appearance;
    };

    apply();
    const id = window.setInterval(apply, 60_000);
    return () => window.clearInterval(id);
  }, [theme]);

  return null;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="schedule"
      enableSystem={false}
      themes={["light", "dark", "schedule"]}
      storageKey={THEME_STORAGE_KEY}
      disableTransitionOnChange
    >
      <ScheduleThemeSync />
      {children}
    </NextThemesProvider>
  );
}
