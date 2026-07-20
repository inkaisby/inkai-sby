export type DuplicateMatchReason = "NIK" | "NIA" | "NAME_BIRTHDATE" | "NAME";

export type DuplicateHit = {
  id: string;
  fullName: string;
  nia: string | null;
  status: string;
  dojoName: string | null;
  /** Cabang dojo (untuk bentrok NIA lintas cabang). */
  branchName: string | null;
  hasAccount: boolean;
  /** Soft-delete / arsip — tidak tampil di daftar aktif. */
  isArchived: boolean;
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

  const whoParts = [primary.fullName];
  if (primary.dojoName) whoParts.push(primary.dojoName);
  if (primary.branchName) whoParts.push(primary.branchName);
  const who = whoParts.length > 1 ? `${whoParts[0]} (${whoParts.slice(1).join(" · ")})` : whoParts[0]!;
  const status = primary.isArchived
    ? " · ARSIP"
    : primary.status
      ? ` · status ${primary.status}`
      : "";
  const niaLabel =
    primary.reasons.includes("NIA") && primary.nia
      ? `NIA ${primary.nia}`
      : reasonLabel || "Identitas";

  if (primary.isArchived) {
    if (context === "public") {
      return (
        `Data dengan ${niaLabel} ini sudah ada di arsip pengurus (${who}). ` +
        "Jangan daftar ulang — hubungi ketua ranting/cabang."
      );
    }
    if (primary.reasons.includes("NAME_BIRTHDATE")) {
      return (
        `Anggota sudah ada di arsip: ${who}${status}` +
        `${reasonLabel ? ` · cocok ${reasonLabel}` : ""}. ` +
        "Buka Kelola Anggota → Lihat arsip, lalu pulihkan data itu (jangan buat baru)."
      );
    }
    return (
      `${niaLabel} masih dipakai oleh ${who}${status}. ` +
      "Buka arsip anggota tersebut, atau simpan lagi agar sistem melepas NIA/NIK dari arsip bila hanya bentrok nomor."
    );
  }

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

  if (primary.reasons.includes("NIA") && primary.nia) {
    return (
      `NIA ${primary.nia} sudah digunakan oleh ${who}${status}` +
      `${primary.hasAccount ? " · sudah punya akun" : ""}. ` +
      "Ganti NIA atau periksa data anggota tersebut."
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

/** Duplikat keras yang masih aktif (bukan arsip). */
export function activeHardDuplicates(hits: DuplicateHit[]): DuplicateHit[] {
  return hardDuplicates(hits).filter((h) => !h.isArchived);
}

/**
 * Bentrok NIA/NIK hanya dengan arsip (bukan nama+TTL) — aman dilepas untuk dipakai ulang.
 */
export function releasableArchivedIdConflicts(
  hits: DuplicateHit[],
): DuplicateHit[] {
  return hardDuplicates(hits).filter(
    (h) =>
      h.isArchived &&
      !h.reasons.includes("NAME_BIRTHDATE") &&
      (h.reasons.includes("NIA") || h.reasons.includes("NIK")),
  );
}

/** Arsip dengan nama+TTL sama — harus dipulihkan, bukan dibuat baru. */
export function archivedIdentityConflicts(hits: DuplicateHit[]): DuplicateHit[] {
  return hardDuplicates(hits).filter(
    (h) => h.isArchived && h.reasons.includes("NAME_BIRTHDATE"),
  );
}
