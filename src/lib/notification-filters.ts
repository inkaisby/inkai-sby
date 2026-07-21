/** Filter notifikasi murni (aman untuk unit test, tanpa Prisma). */

export type NotifText = {
  title?: string | null;
  content?: string | null;
  userId?: string | null;
  audience?: string | null;
};

/** Fallback judul ops admin bila `audience` belum ada (data lama). */
const ADMIN_OPS_TITLE_RE = [
  /^Anggota mendaftar kegiatan mandiri$/i,
  /^Pendaftaran Event Baru$/i,
  /^Pendaftaran Event \(oleh pengurus\)$/i,
  /^Anggota Baru Terdaftar$/i,
  /^Periode UKT .+ dibuka$/i,
  /^Pendaftaran UKT dibuka:/i,
  /^Batas pendaftaran UKT diperpanjang$/i,
  /^Pengingat: batas UKT/i,
  /^Susunan pengurus diperbarui$/i,
  /^Akun admin wilayah baru$/i,
  /^Perubahan akun wilayah$/i,
  /^Kredensial user baru$/i,
  /^Password direset$/i,
  /^\[PIC\] /i,
];

const ADMIN_OPS_CONTENT_RE = [/mendaftar sendiri untuk/i];

/** Fallback notif pribadi anggota (data lama tanpa audience). */
const MEMBER_PERSONAL_TITLE_RE = [
  /^Data keanggotaan diperbarui$/i,
  /^Data keanggotaan diarsipkan$/i,
  /^Keanggotaan /i,
  /^Akun digabungkan$/i,
  /^Verifikasi disetujui$/i,
  /^Verifikasi ditolak$/i,
  /^Pesan baru dari pengurus$/i,
  /^Tagihan Pendaftaran Event$/i,
  /^UKT — /i,
];

const MEMBER_PERSONAL_CONTENT_RE = [
  /Sabuk\/Kyu Anda/i,
  /Pengajuan Anda/i,
  /Pendaftaran Anda/i,
  /telah digabungkan oleh pengurus/i,
  /diarsipkan oleh pengurus/i,
  /diaktifkan kembali/i,
  /Silakan lanjut pembayaran/i,
];

/** Ops cabang ke semua ranting / notif akun admin (tanpa wajib sebut dojo). */
const BRANCH_WIDE_ADMIN_TITLE_RE = [
  /^Periode UKT .+ dibuka$/i,
  /^Pendaftaran UKT dibuka:/i,
  /^Batas pendaftaran UKT diperpanjang$/i,
  /^Pengingat: batas UKT/i,
  /^Susunan pengurus diperbarui$/i,
  /^Akun admin wilayah baru$/i,
  /^Perubahan akun wilayah$/i,
  /^Kredensial user baru$/i,
  /^Password direset$/i,
  /^\[PIC\] /i,
];

export function normalizeAudience(
  audience: string | null | undefined,
): "MEMBER" | "ADMIN" | "BROADCAST" | null {
  if (audience === "MEMBER" || audience === "ADMIN" || audience === "BROADCAST") {
    return audience;
  }
  return null;
}

export function isAdminOpsNotification(
  item: Pick<NotifText, "title" | "content" | "audience">,
): boolean {
  const audience = normalizeAudience(item.audience);
  if (audience === "ADMIN") return true;
  if (audience === "MEMBER" || audience === "BROADCAST") return false;
  const title = (item.title ?? "").trim();
  const content = item.content ?? "";
  if (ADMIN_OPS_TITLE_RE.some((re) => re.test(title))) return true;
  if (ADMIN_OPS_CONTENT_RE.some((re) => re.test(content))) return true;
  return false;
}

export function isMemberPersonalNotification(
  item: Pick<NotifText, "title" | "content" | "audience">,
): boolean {
  const audience = normalizeAudience(item.audience);
  if (audience === "MEMBER") return true;
  if (audience === "ADMIN" || audience === "BROADCAST") return false;
  const title = (item.title ?? "").trim();
  const content = item.content ?? "";
  if (MEMBER_PERSONAL_TITLE_RE.some((re) => re.test(title))) return true;
  if (MEMBER_PERSONAL_CONTENT_RE.some((re) => re.test(content))) return true;
  return false;
}

export function isBranchWideAdminNotification(
  item: Pick<NotifText, "title" | "content">,
): boolean {
  const title = (item.title ?? "").trim();
  return BRANCH_WIDE_ADMIN_TITLE_RE.some((re) => re.test(title));
}

/** Kunci ke penerima yang benar jika payload punya userId. */
export function filterNotificationsForCurrentUser<T extends NotifText>(
  userId: string,
  items: T[],
): T[] {
  return items.filter((item) => {
    if (typeof item.userId === "string" && item.userId.length > 0) {
      return item.userId === userId;
    }
    return true;
  });
}

/**
 * Inbox dashboard anggota: akun sendiri + tanpa notif ops admin.
 * BROADCAST (pengumuman) tetap tampil.
 */
export function filterNotificationsForMemberInbox<T extends NotifText>(
  userId: string,
  items: T[],
): T[] {
  return filterNotificationsForCurrentUser(userId, items).filter((item) => {
    const audience = normalizeAudience(item.audience);
    if (audience === "ADMIN") return false;
    if (audience === "MEMBER" || audience === "BROADCAST") return true;
    return !isAdminOpsNotification(item);
  });
}

export type NotificationFilterStats = {
  input: number;
  output: number;
  dropped: number;
};

export function withFilterStats<T>(
  input: T[],
  output: T[],
): { items: T[]; stats: NotificationFilterStats } {
  return {
    items: output,
    stats: {
      input: input.length,
      output: output.length,
      dropped: Math.max(0, input.length - output.length),
    },
  };
}
