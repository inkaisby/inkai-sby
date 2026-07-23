export type AppZone = "public" | "admin" | "dashboard" | "auth";

export function getAppZone(pathname: string): AppZone {
  const path = pathname.split("?")[0].split("#")[0] || "/";
  if (path.startsWith("/admin")) return "admin";
  if (path.startsWith("/dashboard")) return "dashboard";
  if (
    path.startsWith("/login") ||
    path.startsWith("/reset-password") ||
    path.startsWith("/forgot-password")
  ) {
    return "auth";
  }
  return "public";
}

/** Perpindahan antar portal / auth — tampilkan logo INKAI, bukan progress tipis. */
export function isPortalOrAuthTransition(fromPath: string, toPath: string): boolean {
  return getAppZone(fromPath) !== getAppZone(toPath);
}

export function transitionMessageForPath(toPath: string): string {
  switch (getAppZone(toPath)) {
    case "admin":
      return "Membuka panel admin...";
    case "dashboard":
      return "Membuka dashboard anggota...";
    case "auth":
      return "Menuju halaman masuk...";
    default:
      return "Menuju beranda publik...";
  }
}
