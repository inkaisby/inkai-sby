/** Tema jadwal operasional: 05:00–17:59 terang, 18:00–04:59 gelap (waktu lokal). */

export const THEME_STORAGE_KEY = "inkai-theme";

export type ThemeMode = "schedule" | "light" | "dark";

export function getOperationalTheme(date = new Date()): "light" | "dark" {
  const hour = date.getHours();
  return hour >= 5 && hour < 18 ? "light" : "dark";
}

export function normalizeThemeMode(
  raw: string | null | undefined,
): ThemeMode {
  if (raw === "light" || raw === "dark" || raw === "schedule") return raw;
  // Migrasi dari default lama (ikuti OS)
  if (raw === "system") return "schedule";
  return "schedule";
}

export function resolveAppearance(
  theme: string | undefined,
  date = new Date(),
): "light" | "dark" {
  const mode = normalizeThemeMode(theme);
  if (mode === "light" || mode === "dark") return mode;
  return getOperationalTheme(date);
}

export function nextThemeMode(current: string | undefined): ThemeMode {
  const mode = normalizeThemeMode(current);
  if (mode === "schedule") return "light";
  if (mode === "light") return "dark";
  return "schedule";
}

export function themeModeLabel(
  theme: string | undefined,
  appearance: string | undefined,
): string {
  const mode = normalizeThemeMode(theme);
  const look = appearance === "dark" ? "gelap" : "terang";
  if (mode === "schedule") {
    return `Otomatis jam operasional · ${look} (05–17 terang, 18–04 gelap) — ketuk untuk manual`;
  }
  if (mode === "light") return "Mode terang — ketuk untuk gelap";
  return "Mode gelap — ketuk untuk otomatis (jam operasional)";
}

/**
 * Script anti-FOUC — harus selaras dengan getOperationalTheme.
 * Migrasi `system` → `schedule` di localStorage.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var t=localStorage.getItem(k);if(t==="system"){t="schedule";localStorage.setItem(k,t);}var m;if(t==="light"||t==="dark")m=t;else{var h=new Date().getHours();m=(h>=5&&h<18)?"light":"dark";}var e=document.documentElement;e.classList.remove("light","dark","schedule","system");e.classList.add(m);if(e.style)e.style.colorScheme=m;}catch(err){}})();`;
