import { prisma } from "@/lib/prisma";
import { getPrimaryAdminRole, type SessionUser } from "@/lib/rbac";

export const MANAGED_DOJOS_KEY_PREFIX = "user.managedDojos.";

export type ManagedDojosValue = {
  dojoIds: string[];
  /** Ranting utama (selaras User.managedDojoId bila memungkinkan). */
  primaryDojoId: string | null;
  updatedAt?: string;
};

export function managedDojosSettingKey(userId: string) {
  return `${MANAGED_DOJOS_KEY_PREFIX}${userId}`;
}

function asManagedDojosValue(raw: unknown): ManagedDojosValue {
  if (!raw || typeof raw !== "object") {
    return { dojoIds: [], primaryDojoId: null };
  }
  const v = raw as Record<string, unknown>;
  const dojoIds = Array.isArray(v.dojoIds)
    ? [...new Set(v.dojoIds.filter((id): id is string => typeof id === "string" && id.length > 0))]
    : [];
  const primaryDojoId =
    typeof v.primaryDojoId === "string" && dojoIds.includes(v.primaryDojoId)
      ? v.primaryDojoId
      : dojoIds[0] ?? null;
  return {
    dojoIds,
    primaryDojoId,
    updatedAt: typeof v.updatedAt === "string" ? v.updatedAt : undefined,
  };
}

/** Gabungkan primary dari login/DB dengan daftar ekstra di AppSetting. */
export function mergeManagedDojoIds(
  primaryDojoId: string | null | undefined,
  extraIds: string[],
): string[] {
  const ids = [
    ...(primaryDojoId ? [primaryDojoId] : []),
    ...extraIds,
  ];
  return [...new Set(ids.filter(Boolean))];
}

export async function getManagedDojosSetting(
  userId: string,
): Promise<ManagedDojosValue> {
  const row = await prisma.appSetting.findUnique({
    where: { key: managedDojosSettingKey(userId) },
    select: { value: true },
  });
  return asManagedDojosValue(row?.value);
}

export async function loadManagedDojoIds(
  userId: string,
  primaryDojoId?: string | null,
): Promise<string[]> {
  const setting = await getManagedDojosSetting(userId);
  return mergeManagedDojoIds(primaryDojoId ?? setting.primaryDojoId, setting.dojoIds);
}

/**
 * Simpan daftar ranting yang dikelola. Memastikan primary ada di daftar,
 * dan menyelaraskan User.managedDojoId ke primary (kompatibilitas Inkai API).
 */
export async function setManagedDojoIds(opts: {
  userId: string;
  dojoIds: string[];
  primaryDojoId: string;
  /** Validasi semua dojo berada di cabang ini (opsional). */
  branchId?: string;
}): Promise<{ dojoIds: string[]; primaryDojoId: string }> {
  const unique = [...new Set(opts.dojoIds.filter(Boolean))];
  if (unique.length === 0) {
    throw new Error("Minimal satu ranting harus dipilih");
  }
  if (!unique.includes(opts.primaryDojoId)) {
    throw new Error("Ranting utama harus termasuk daftar yang dikelola");
  }

  const dojos = await prisma.dojo.findMany({
    where: {
      id: { in: unique },
      isDeleted: false,
      ...(opts.branchId ? { branchId: opts.branchId } : {}),
    },
    select: { id: true, branchId: true },
  });
  if (dojos.length !== unique.length) {
    throw new Error("Satu atau lebih ranting tidak valid / di luar cabang");
  }
  const branchIds = [...new Set(dojos.map((d) => d.branchId))];
  if (branchIds.length > 1) {
    throw new Error("Semua ranting harus dalam satu cabang yang sama");
  }

  const value: ManagedDojosValue = {
    dojoIds: unique,
    primaryDojoId: opts.primaryDojoId,
    updatedAt: new Date().toISOString(),
  };

  await prisma.$transaction([
    prisma.appSetting.upsert({
      where: { key: managedDojosSettingKey(opts.userId) },
      create: { key: managedDojosSettingKey(opts.userId), value },
      update: { value },
    }),
    prisma.user.update({
      where: { id: opts.userId },
      data: { managedDojoId: opts.primaryDojoId },
    }),
  ]);

  return { dojoIds: unique, primaryDojoId: opts.primaryDojoId };
}

/** Tambah ranting ke daftar kelola tanpa menghapus yang lain. */
export async function addManagedDojo(opts: {
  userId: string;
  dojoId: string;
  branchId: string;
  makePrimary?: boolean;
}): Promise<{ dojoIds: string[]; primaryDojoId: string }> {
  const user = await prisma.user.findFirst({
    where: { id: opts.userId, isDeleted: false },
    select: { id: true, managedDojoId: true },
  });
  if (!user) throw new Error("Akun tidak ditemukan");

  const current = await loadManagedDojoIds(user.id, user.managedDojoId);
  const next = mergeManagedDojoIds(null, [...current, opts.dojoId]);
  const primary =
    opts.makePrimary || !user.managedDojoId
      ? opts.dojoId
      : user.managedDojoId && next.includes(user.managedDojoId)
        ? user.managedDojoId
        : opts.dojoId;

  return setManagedDojoIds({
    userId: opts.userId,
    dojoIds: next,
    primaryDojoId: primary,
    branchId: opts.branchId,
  });
}

/** Cabut ranting dari daftar; tidak menonaktifkan akun. */
export async function removeManagedDojo(opts: {
  userId: string;
  dojoId: string;
}): Promise<{ dojoIds: string[]; primaryDojoId: string } | null> {
  const user = await prisma.user.findFirst({
    where: { id: opts.userId, isDeleted: false },
    select: { id: true, managedDojoId: true },
  });
  if (!user) throw new Error("Akun tidak ditemukan");

  const current = await loadManagedDojoIds(user.id, user.managedDojoId);
  const next = current.filter((id) => id !== opts.dojoId);
  if (next.length === 0) {
    throw new Error(
      "Tidak dapat mencabut ranting terakhir. Nonaktifkan akun atau pindahkan ke ranting lain.",
    );
  }
  const primary =
    user.managedDojoId && next.includes(user.managedDojoId)
      ? user.managedDojoId
      : next[0];

  const homeDojo = await prisma.dojo.findFirst({
    where: { id: primary, isDeleted: false },
    select: { branchId: true },
  });

  return setManagedDojoIds({
    userId: opts.userId,
    dojoIds: next,
    primaryDojoId: primary,
    branchId: homeDojo?.branchId,
  });
}

export async function enrichSessionUser(user: SessionUser): Promise<SessionUser> {
  const role = getPrimaryAdminRole(user.roles);
  if (role !== "ADMIN_DOJO") {
    const single = user.managedDojoId ? [user.managedDojoId] : [];
    return { ...user, managedDojoIds: single };
  }
  try {
    const ids = await loadManagedDojoIds(user.id, user.managedDojoId);
    return {
      ...user,
      managedDojoIds: ids,
      managedDojoId: user.managedDojoId ?? ids[0] ?? null,
    };
  } catch {
    const fallback = user.managedDojoId ? [user.managedDojoId] : [];
    return { ...user, managedDojoIds: fallback };
  }
}

export function getManagedDojoIdsFromUser(user: SessionUser): string[] {
  if (user.managedDojoIds && user.managedDojoIds.length > 0) {
    return user.managedDojoIds;
  }
  return user.managedDojoId ? [user.managedDojoId] : [];
}

/**
 * Resolve filter dojo aktif dari query.
 * - null = semua ranting yang diizinkan (multi)
 * - string = satu ranting (harus dalam allowlist)
 */
export function resolveActiveDojoId(
  user: SessionUser,
  requested: string | null | undefined,
): { ok: true; activeDojoId: string | null; allowlist: string[] } | { ok: false; error: string } {
  const allowlist = getManagedDojoIdsFromUser(user);
  const role = getPrimaryAdminRole(user.roles);

  if (role !== "ADMIN_DOJO") {
    return { ok: true, activeDojoId: requested?.trim() || null, allowlist };
  }

  if (allowlist.length === 0) {
    return { ok: false, error: "Akun belum terhubung ke ranting" };
  }

  const req = requested?.trim() || "";
  if (!req) {
    // Satu ranting → kunci ke itu; multi → semua (null)
    return {
      ok: true,
      activeDojoId: allowlist.length === 1 ? allowlist[0] : null,
      allowlist,
    };
  }
  if (!allowlist.includes(req)) {
    return { ok: false, error: "Ranting di luar cakupan akun Anda" };
  }
  return { ok: true, activeDojoId: req, allowlist };
}

export function assertDojoAllowed(user: SessionUser, dojoId: string): boolean {
  const role = getPrimaryAdminRole(user.roles);
  if (role !== "ADMIN_DOJO") return true;
  return getManagedDojoIdsFromUser(user).includes(dojoId);
}

/** Dojo IDs untuk query Prisma/API: satu id atau daftar allowlist. */
export function dojoIdsForQuery(
  user: SessionUser,
  activeDojoId: string | null,
): string[] {
  const allowlist = getManagedDojoIdsFromUser(user);
  if (activeDojoId) return [activeDojoId];
  return allowlist;
}

/** Cari user ADMIN_DOJO yang mengelola dojoId (primary atau ekstra). */
export async function findUserIdsManagingDojo(dojoId: string): Promise<string[]> {
  const [homes, settings] = await Promise.all([
    prisma.user.findMany({
      where: {
        isDeleted: false,
        managedDojoId: dojoId,
        roles: { some: { name: "ADMIN_DOJO" } },
      },
      select: { id: true },
    }),
    prisma.appSetting.findMany({
      where: { key: { startsWith: MANAGED_DOJOS_KEY_PREFIX } },
      select: { key: true, value: true },
    }),
  ]);

  const ids = new Set(homes.map((u) => u.id));
  for (const row of settings) {
    const parsed = asManagedDojosValue(row.value);
    if (!parsed.dojoIds.includes(dojoId)) continue;
    const userId = row.key.slice(MANAGED_DOJOS_KEY_PREFIX.length);
    if (userId) ids.add(userId);
  }
  return [...ids];
}

export type ManagedDojoMatrixRow = {
  userId: string;
  email: string;
  fullName: string | null;
  isActive: boolean;
  primaryDojoId: string | null;
  primaryDojoName: string | null;
  dojoIds: string[];
  dojoNames: string[];
};

/** Matriks pengelola multi-ranting dalam satu cabang (untuk UI cabang). */
export async function loadManagedDojoMatrix(branchId: string): Promise<{
  dojos: Array<{ id: string; name: string }>;
  rows: ManagedDojoMatrixRow[];
}> {
  const dojos = await prisma.dojo.findMany({
    where: { branchId, isDeleted: false },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const dojoIds = dojos.map((d) => d.id);
  const dojoNameById = new Map(dojos.map((d) => [d.id, d.name]));

  if (dojoIds.length === 0) {
    return { dojos: [], rows: [] };
  }

  const users = await prisma.user.findMany({
    where: {
      isDeleted: false,
      roles: { some: { name: "ADMIN_DOJO" } },
      OR: [
        { managedDojoId: { in: dojoIds } },
        // ekstra di-load via settings di bawah
      ],
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      isActive: true,
      managedDojoId: true,
    },
    orderBy: { email: "asc" },
  });

  const settings = await prisma.appSetting.findMany({
    where: { key: { startsWith: MANAGED_DOJOS_KEY_PREFIX } },
    select: { key: true, value: true },
  });
  const settingByUser = new Map<string, ManagedDojosValue>();
  for (const row of settings) {
    const userId = row.key.slice(MANAGED_DOJOS_KEY_PREFIX.length);
    settingByUser.set(userId, asManagedDojosValue(row.value));
  }

  // Sertakan user yang hanya muncul di setting (extra manager)
  const userById = new Map(users.map((u) => [u.id, u]));
  for (const [userId, setting] of settingByUser) {
    if (userById.has(userId)) continue;
    if (!setting.dojoIds.some((id) => dojoIds.includes(id))) continue;
    const u = await prisma.user.findFirst({
      where: {
        id: userId,
        isDeleted: false,
        roles: { some: { name: "ADMIN_DOJO" } },
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        isActive: true,
        managedDojoId: true,
      },
    });
    if (u) userById.set(u.id, u);
  }

  const rows: ManagedDojoMatrixRow[] = [];
  for (const u of userById.values()) {
    const setting = settingByUser.get(u.id);
    const ids = mergeManagedDojoIds(
      u.managedDojoId,
      setting?.dojoIds ?? [],
    ).filter((id) => dojoIds.includes(id));
    if (ids.length === 0) continue;
    const primaryDojoId =
      u.managedDojoId && ids.includes(u.managedDojoId)
        ? u.managedDojoId
        : setting?.primaryDojoId && ids.includes(setting.primaryDojoId)
          ? setting.primaryDojoId
          : ids[0];
    rows.push({
      userId: u.id,
      email: u.email,
      fullName: u.fullName,
      isActive: u.isActive,
      primaryDojoId,
      primaryDojoName: primaryDojoId
        ? dojoNameById.get(primaryDojoId) ?? null
        : null,
      dojoIds: ids,
      dojoNames: ids.map((id) => dojoNameById.get(id) ?? id),
    });
  }

  rows.sort((a, b) => a.email.localeCompare(b.email));
  return { dojos, rows };
}
