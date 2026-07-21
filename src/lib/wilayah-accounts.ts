import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notifications";
import {
  findUserIdsManagingDojo,
  loadManagedDojoIds,
} from "@/lib/managed-dojos";

export type WilayahScope = "branch" | "dojo";

export const WILAYAH_JABATAN = [
  { value: "KETUA", label: "Ketua" },
  { value: "SEKRETARIS", label: "Sekretaris" },
  { value: "BENDAHARA", label: "Bendahara" },
  { value: "PENGURUS", label: "Pengurus" },
] as const;

export type WilayahJabatan = (typeof WILAYAH_JABATAN)[number]["value"];

export type WilayahHandover = {
  at: string;
  fromUserId: string | null;
  toUserId: string;
  note: string;
  byUserId: string;
  byEmail: string;
};

type WilayahMeta = {
  jabatanByUserId: Record<string, WilayahJabatan>;
  handovers: WilayahHandover[];
  updatedAt?: string;
};

export function primarySettingKey(scope: WilayahScope, wilayahId: string) {
  return `wilayah.primary.${scope}.${wilayahId}`;
}

export function metaSettingKey(scope: WilayahScope, wilayahId: string) {
  return `wilayah.meta.${scope}.${wilayahId}`;
}

export function jabatanLabel(value: string | null | undefined) {
  if (!value) return null;
  return WILAYAH_JABATAN.find((j) => j.value === value)?.label ?? value;
}

function emptyMeta(): WilayahMeta {
  return { jabatanByUserId: {}, handovers: [] };
}

function asMeta(value: unknown): WilayahMeta {
  if (!value || typeof value !== "object") return emptyMeta();
  const v = value as Record<string, unknown>;
  const rawMap =
    v.jabatanByUserId && typeof v.jabatanByUserId === "object"
      ? (v.jabatanByUserId as Record<string, unknown>)
      : {};
  const jabatanByUserId: Record<string, WilayahJabatan> = {};
  for (const [uid, jab] of Object.entries(rawMap)) {
    if (
      jab === "KETUA" ||
      jab === "SEKRETARIS" ||
      jab === "BENDAHARA" ||
      jab === "PENGURUS"
    ) {
      jabatanByUserId[uid] = jab;
    }
  }
  const handovers = Array.isArray(v.handovers)
    ? (v.handovers as WilayahHandover[]).filter(
        (h) => h && typeof h === "object" && typeof h.toUserId === "string",
      )
    : [];
  return {
    jabatanByUserId,
    handovers,
    updatedAt: typeof v.updatedAt === "string" ? v.updatedAt : undefined,
  };
}

export async function getWilayahMeta(
  scope: WilayahScope,
  wilayahId: string,
): Promise<WilayahMeta> {
  const row = await prisma.appSetting.findUnique({
    where: { key: metaSettingKey(scope, wilayahId) },
  });
  return asMeta(row?.value);
}

async function saveWilayahMeta(
  scope: WilayahScope,
  wilayahId: string,
  meta: WilayahMeta,
) {
  const value = { ...meta, updatedAt: new Date().toISOString() };
  await prisma.appSetting.upsert({
    where: { key: metaSettingKey(scope, wilayahId) },
    create: { key: metaSettingKey(scope, wilayahId), value },
    update: { value },
  });
}

export async function setAccountJabatan(opts: {
  scope: WilayahScope;
  wilayahId: string;
  userId: string;
  jabatan: WilayahJabatan | null;
}) {
  const meta = await getWilayahMeta(opts.scope, opts.wilayahId);
  if (opts.jabatan) {
    meta.jabatanByUserId[opts.userId] = opts.jabatan;
  } else {
    delete meta.jabatanByUserId[opts.userId];
  }
  await saveWilayahMeta(opts.scope, opts.wilayahId, meta);
}

export async function getPrimaryAccountId(
  scope: WilayahScope,
  wilayahId: string,
): Promise<string | null> {
  const row = await prisma.appSetting.findUnique({
    where: { key: primarySettingKey(scope, wilayahId) },
  });
  if (!row?.value || typeof row.value !== "object") return null;
  const id = (row.value as { userId?: unknown }).userId;
  return typeof id === "string" ? id : null;
}

export async function setPrimaryAccountId(
  scope: WilayahScope,
  wilayahId: string,
  userId: string,
) {
  const value = { userId, updatedAt: new Date().toISOString() };
  await prisma.appSetting.upsert({
    where: { key: primarySettingKey(scope, wilayahId) },
    create: { key: primarySettingKey(scope, wilayahId), value },
    update: { value },
  });
}

export async function performHandover(opts: {
  scope: WilayahScope;
  wilayahId: string;
  toUserId: string;
  fromUserId?: string | null;
  note?: string;
  byUserId: string;
  byEmail: string;
  deactivatePrevious?: boolean;
}) {
  const previousId =
    opts.fromUserId ?? (await getPrimaryAccountId(opts.scope, opts.wilayahId));

  await setPrimaryAccountId(opts.scope, opts.wilayahId, opts.toUserId);

  const meta = await getWilayahMeta(opts.scope, opts.wilayahId);
  meta.handovers = [
    {
      at: new Date().toISOString(),
      fromUserId: previousId && previousId !== opts.toUserId ? previousId : null,
      toUserId: opts.toUserId,
      note: (opts.note || "").trim().slice(0, 500),
      byUserId: opts.byUserId,
      byEmail: opts.byEmail,
    },
    ...meta.handovers,
  ].slice(0, 20);
  await saveWilayahMeta(opts.scope, opts.wilayahId, meta);

  if (
    opts.deactivatePrevious &&
    previousId &&
    previousId !== opts.toUserId
  ) {
    const remaining = await countActiveWilayahAccounts({
      scope: opts.scope,
      wilayahId: opts.wilayahId,
      excludeUserId: previousId,
    });
    if (remaining >= 1) {
      await prisma.user.update({
        where: { id: previousId },
        data: { isActive: false },
      });
    }
  }

  return { previousId };
}

export async function listWilayahAccounts(opts: {
  scope: WilayahScope;
  wilayahId: string;
}) {
  const where =
    opts.scope === "branch"
      ? {
          managedBranchId: opts.wilayahId,
          roles: { some: { name: "ADMIN_BRANCH" } },
        }
      : {
          // Primary home — ekstra digabung di bawah
          managedDojoId: opts.wilayahId,
          roles: { some: { name: "ADMIN_DOJO" } },
        };

  const [homeUsers, primaryId, meta, extraUserIds] = await Promise.all([
    prisma.user.findMany({
      where: { isDeleted: false, ...where },
      select: {
        id: true,
        email: true,
        fullName: true,
        phoneNumber: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        managedDojoId: true,
      },
      orderBy: [{ isActive: "desc" }, { email: "asc" }],
    }),
    getPrimaryAccountId(opts.scope, opts.wilayahId),
    getWilayahMeta(opts.scope, opts.wilayahId),
    opts.scope === "dojo"
      ? findUserIdsManagingDojo(opts.wilayahId)
      : Promise.resolve([] as string[]),
  ]);

  let users = homeUsers;
  if (opts.scope === "dojo" && extraUserIds.length > 0) {
    const missing = extraUserIds.filter((id) => !users.some((u) => u.id === id));
    if (missing.length > 0) {
      const extras = await prisma.user.findMany({
        where: {
          id: { in: missing },
          isDeleted: false,
          roles: { some: { name: "ADMIN_DOJO" } },
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          phoneNumber: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          managedDojoId: true,
        },
      });
      users = [...users, ...extras].sort((a, b) => {
        if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
        return a.email.localeCompare(b.email);
      });
    }
  }

  const managedMap = new Map<string, string[]>();
  if (opts.scope === "dojo") {
    await Promise.all(
      users.map(async (u) => {
        const ids = await loadManagedDojoIds(u.id, u.managedDojoId);
        managedMap.set(u.id, ids);
      }),
    );
  }

  let effectivePrimary = primaryId;
  if (effectivePrimary && !users.some((u) => u.id === effectivePrimary)) {
    effectivePrimary = null;
  }
  if (!effectivePrimary) {
    const homeActive = users.find(
      (u) => u.isActive && u.managedDojoId === opts.wilayahId,
    );
    const firstActive = homeActive ?? users.find((u) => u.isActive) ?? users[0];
    effectivePrimary = firstActive?.id ?? null;
    if (effectivePrimary) {
      await setPrimaryAccountId(opts.scope, opts.wilayahId, effectivePrimary);
    }
  }

  return {
    accounts: users.map((u) => {
      const managedDojoIds = managedMap.get(u.id) ?? [];
      return {
        ...u,
        createdAt: u.createdAt.toISOString(),
        updatedAt: u.updatedAt.toISOString(),
        isPrimary: u.id === effectivePrimary,
        isHomeDojo: u.managedDojoId === opts.wilayahId,
        managedDojoIds,
        managedDojoCount: managedDojoIds.length,
        jabatan: meta.jabatanByUserId[u.id] ?? null,
        jabatanLabel: jabatanLabel(meta.jabatanByUserId[u.id] ?? null),
      };
    }),
    handovers: meta.handovers,
    primaryContact: (() => {
      const p = users.find((u) => u.id === effectivePrimary);
      if (!p) return null;
      return {
        userId: p.id,
        email: p.email,
        fullName: p.fullName,
        phoneNumber: p.phoneNumber,
        jabatan: meta.jabatanByUserId[p.id] ?? null,
        jabatanLabel: jabatanLabel(meta.jabatanByUserId[p.id] ?? null),
      };
    })(),
  };
}

export async function countActiveWilayahAccounts(opts: {
  scope: WilayahScope;
  wilayahId: string;
  excludeUserId?: string;
}) {
  const where =
    opts.scope === "branch"
      ? {
          managedBranchId: opts.wilayahId,
          roles: { some: { name: "ADMIN_BRANCH" } },
        }
      : {
          managedDojoId: opts.wilayahId,
          roles: { some: { name: "ADMIN_DOJO" } },
        };

  return prisma.user.count({
    where: {
      isDeleted: false,
      isActive: true,
      ...where,
      ...(opts.excludeUserId ? { id: { not: opts.excludeUserId } } : {}),
    },
  });
}

/** Notifikasi rekan wilayah; PIC utama mendapat judul prioritas. */
export async function notifyWilayahAdmins(opts: {
  scope: WilayahScope;
  wilayahId: string;
  token: string;
  title: string;
  content: string;
  excludeUserId?: string;
}) {
  const { accounts, primaryContact } = await listWilayahAccounts({
    scope: opts.scope,
    wilayahId: opts.wilayahId,
  });
  const targets = accounts.filter(
    (a) => a.isActive && a.id !== opts.excludeUserId,
  );
  await Promise.allSettled(
    targets.map((a) => {
      const isPic = primaryContact?.userId === a.id;
      return notifyUser({
        userId: a.id,
        title: isPic ? `[PIC] ${opts.title}` : opts.title,
        content: isPic
          ? `Sebagai PIC utama: ${opts.content}`
          : opts.content,
        type: "INFO",
        token: opts.token,
        audience: "ADMIN",
      });
    }),
  );
}

export async function loadPrimaryEmailsByWilayah(opts: {
  scope: WilayahScope;
  wilayahIds: string[];
}): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!opts.wilayahIds.length) return map;

  const keys = opts.wilayahIds.map((id) => primarySettingKey(opts.scope, id));
  const settings = await prisma.appSetting.findMany({
    where: { key: { in: keys } },
    select: { key: true, value: true },
  });

  const userIds: string[] = [];
  const wilayahByUser = new Map<string, string>();
  for (const s of settings) {
    const wilayahId = s.key.split(".").pop();
    if (!wilayahId || !s.value || typeof s.value !== "object") continue;
    const userId = (s.value as { userId?: unknown }).userId;
    if (typeof userId !== "string") continue;
    userIds.push(userId);
    wilayahByUser.set(userId, wilayahId);
  }

  if (!userIds.length) return map;

  const users = await prisma.user.findMany({
    where: { id: { in: userIds }, isDeleted: false },
    select: { id: true, email: true },
  });
  for (const u of users) {
    const wilayahId = wilayahByUser.get(u.id);
    if (wilayahId) map.set(wilayahId, u.email);
  }
  return map;
}
