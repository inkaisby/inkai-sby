import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notifications";

export type WilayahScope = "branch" | "dojo";

export function primarySettingKey(scope: WilayahScope, wilayahId: string) {
  return `wilayah.primary.${scope}.${wilayahId}`;
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
          managedDojoId: opts.wilayahId,
          roles: { some: { name: "ADMIN_DOJO" } },
        };

  const [users, primaryId] = await Promise.all([
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
      },
      orderBy: [{ isActive: "desc" }, { email: "asc" }],
    }),
    getPrimaryAccountId(opts.scope, opts.wilayahId),
  ]);

  let effectivePrimary = primaryId;
  if (effectivePrimary && !users.some((u) => u.id === effectivePrimary)) {
    effectivePrimary = null;
  }
  if (!effectivePrimary) {
    const firstActive = users.find((u) => u.isActive) ?? users[0];
    effectivePrimary = firstActive?.id ?? null;
    if (effectivePrimary) {
      await setPrimaryAccountId(opts.scope, opts.wilayahId, effectivePrimary);
    }
  }

  return users.map((u) => ({
    ...u,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
    isPrimary: u.id === effectivePrimary,
  }));
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

export async function notifyWilayahAdmins(opts: {
  scope: WilayahScope;
  wilayahId: string;
  token: string;
  title: string;
  content: string;
  excludeUserId?: string;
}) {
  const accounts = await listWilayahAccounts({
    scope: opts.scope,
    wilayahId: opts.wilayahId,
  });
  const targets = accounts.filter(
    (a) => a.isActive && a.id !== opts.excludeUserId,
  );
  await Promise.allSettled(
    targets.map((a) =>
      notifyUser({
        userId: a.id,
        title: opts.title,
        content: opts.content,
        type: "INFO",
        token: opts.token,
      }),
    ),
  );
}
