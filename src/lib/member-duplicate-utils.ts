export type DuplicateMatchReason = "NIK" | "NIA" | "NAME_BIRTHDATE" | "NAME";

export type DuplicateHit = {
  id: string;
  fullName: string;
  nia: string | null;
  status: string;
  dojoName: string | null;
  hasAccount: boolean;
  reasons: DuplicateMatchReason[];
  severity: "hard" | "soft";
};

export function normalizeMemberName(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, " ");
}

/** Parse YYYY-MM-DD (atau ISO) ke rentang UTC hari itu. */
export function birthDateDayRange(value: string): { gte: Date; lt: Date } | null {
  const day = value.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const [y, m, d] = day.split("-").map(Number);
  if (!y || !m || !d) return null;
  const gte = new Date(Date.UTC(y, m - 1, d));
  const lt = new Date(Date.UTC(y, m - 1, d + 1));
  return { gte, lt };
}

export function formatDuplicateError(
  hits: DuplicateHit[],
  context: "admin" | "public" = "admin",
): string {
  const hard = hits.filter((h) => h.severity === "hard");
  const primary = hard[0] ?? hits[0];
  if (!primary) return "Data anggota terindikasi duplikat";

  const reasonLabel = primary.reasons
    .filter((r) => r !== "NAME")
    .map((r) => {
      if (r === "NIK") return "NIK";
      if (r === "NIA") return "NIA";
      if (r === "NAME_BIRTHDATE") return "nama + tanggal lahir";
      return r;
    })
    .join(", ");

  const who = primary.dojoName
    ? `${primary.fullName} (${primary.dojoName})`
    : primary.fullName;
  const status = primary.status ? ` · status ${primary.status}` : "";

  if (context === "public") {
    if (!primary.hasAccount) {
      return (
        `Data Anda sudah terdaftar oleh pengurus ranting (${who}${status}` +
        `${reasonLabel ? ` · cocok ${reasonLabel}` : ""}). ` +
        "Jangan daftar ulang — hubungi ketua ranting agar akun login digabungkan ke data yang sudah ada."
      );
    }
    return (
      `Anda sudah terdaftar (${who}${status}` +
      `${reasonLabel ? ` · cocok ${reasonLabel}` : ""}). ` +
      "Silakan login, atau hubungi admin jika menunggu verifikasi / perlu digabung."
    );
  }

  return (
    `Anggota sudah terdaftar: ${who}${status}` +
    `${reasonLabel ? ` · cocok ${reasonLabel}` : ""}` +
    `${primary.hasAccount ? " · sudah punya akun" : " · belum punya akun"}` +
    ". Batalkan atau periksa data sebelum menambah ulang."
  );
}

export function hardDuplicates(hits: DuplicateHit[]): DuplicateHit[] {
  return hits.filter((h) => h.severity === "hard");
}
