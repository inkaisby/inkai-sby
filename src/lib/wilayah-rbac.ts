import { getPrimaryAdminRole } from "@/lib/rbac";

/**
 * Matriks WILAYAH (User / Ranting / Cabang / Pengprov).
 * Sumber aturan organisasi INKAI Surabaya.
 */

export type WilayahColumn = "USER" | "RANTING" | "CABANG" | "PENGPROV";

export type WilayahMatrixRow = {
  id: string;
  label: string;
  cells: Record<WilayahColumn, string>;
};

/** Tabel referensi untuk UI + dokumentasi aturan. */
export const WILAYAH_MATRIX: WilayahMatrixRow[] = [
  {
    id: "profil",
    label: "Profil & akun",
    cells: {
      USER: "Edit profil sendiri",
      RANTING: "Tidak edit akun anggota",
      CABANG: "Lihat semua ranting & anggota di bawahnya",
      PENGPROV: "Lihat semua cabang, ranting & anggota di bawahnya",
    },
  },
  {
    id: "kyu",
    label: "Kyu / DAN",
    cells: {
      USER: "Tidak bisa edit Kyu/DAN sendiri",
      RANTING: "Tidak bisa edit Kyu/DAN",
      CABANG: "Edit Kyu (UKT & anggota) — satu-satunya yang boleh",
      PENGPROV: "Tidak edit Kyu/DAN (hanya lihat)",
    },
  },
  {
    id: "event",
    label: "Event (UKT, Gashuku, pertandingan)",
    cells: {
      USER: "Lihat & daftar sendiri",
      RANTING: "Daftarkan anggota ranting secara manual",
      CABANG: "Buat event + lihat daftar pendaftar",
      PENGPROV: "Lihat event & daftar yang mendaftar",
    },
  },
  {
    id: "nia",
    label: "NIA",
    cells: {
      USER: "Lihat NIA sendiri",
      RANTING: "Tidak assign NIA",
      CABANG: "Assign / isi NIA anggota",
      PENGPROV: "Lihat NIA (tidak assign)",
    },
  },
  {
    id: "iuran",
    label: "Iuran",
    cells: {
      USER: "Lihat & bayar iuran sendiri",
      RANTING: "Lihat iuran anggota ranting + verifikasi bukti",
      CABANG: "Lihat & kelola iuran wilayah cabang",
      PENGPROV: "Lihat iuran wilayah provinsi",
    },
  },
];

export const WILAYAH_COLUMN_LABELS: Record<WilayahColumn, string> = {
  USER: "User / Anggota",
  RANTING: "Ranting",
  CABANG: "Cabang",
  PENGPROV: "Pengprov",
};

function primary(roles: string[]) {
  return getPrimaryAdminRole(roles);
}

/** Super-admin nasional — override penuh. */
export function isNationalAdmin(roles: string[]) {
  const r = primary(roles);
  return r === "ADMINISTRATOR" || r === "ADMIN_PUSAT" || r === "ADMIN";
}

/** Admin cabang (atau setara nasional). */
export function isCabangAdmin(roles: string[]) {
  return isNationalAdmin(roles) || primary(roles) === "ADMIN_BRANCH";
}

/** Admin pengprov (bukan cabang). */
export function isPengprovAdmin(roles: string[]) {
  return primary(roles) === "ADMIN_PROVINCE";
}

/** Admin ranting/dojo. */
export function isRantingAdmin(roles: string[]) {
  return primary(roles) === "ADMIN_DOJO";
}

/**
 * Edit Kyu Baru / kenaikan sabuk — hanya Cabang (+ nasional).
 * Pengprov & Ranting tidak boleh (sesuai matriks WILAYAH).
 */
export function canEditKyuByWilayah(roles: string[]) {
  return isCabangAdmin(roles);
}

/** Assign NIA — sama dengan cabang. */
export function canAssignNiaByWilayah(roles: string[]) {
  return isCabangAdmin(roles);
}

/**
 * Buat event (UKT / Gashuku / pertandingan) — hanya Cabang (+ nasional).
 * Pengprov hanya lihat.
 */
export function canCreateEventsByWilayah(roles: string[]) {
  return isCabangAdmin(roles);
}

/** Daftarkan anggota ke event — Ranting ke atas. */
export function canRegisterMembersToEvents(roles: string[]) {
  const r = primary(roles);
  return (
    isNationalAdmin(roles) ||
    r === "ADMIN_PROVINCE" ||
    r === "ADMIN_BRANCH" ||
    r === "ADMIN_DOJO"
  );
}

/** Edit akun anggota lain — bukan ranting, bukan anggota biasa. */
export function canEditMemberAccounts(roles: string[]) {
  return isCabangAdmin(roles) || isPengprovAdmin(roles);
}
