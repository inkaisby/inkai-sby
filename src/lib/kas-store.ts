import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { getPrimaryAdminRole, type SessionUser } from "@/lib/rbac";
import { SITE_BRANCH_NAME } from "@/lib/site";
import type { AdminDojoGrants } from "@/lib/admin-dojo-grants";
import { isAdminPathAllowedByGrants } from "@/lib/admin-dojo-grants";
import {
  parseYmd,
  rupiahInt,
  yearMonthFromYmd,
  ymdWib,
  type KasDirection,
  type KasScope,
  type KasSourceType,
} from "@/lib/kas";

export class KasPeriodLockedError extends Error {
  constructor(yearMonth: string) {
    super(`Buku kas ${yearMonth} sudah ditutup`);
    this.name = "KasPeriodLockedError";
  }
}

export class KasScopeError extends Error {
  constructor(message = "Wilayah kas tidak ditemukan") {
    super(message);
    this.name = "KasScopeError";
  }
}

export async function resolveKasScope(user: SessionUser): Promise<KasScope> {
  const role = getPrimaryAdminRole(user.roles ?? []);
  if (role === "ADMIN_DOJO") {
    const id = user.managedDojoId ?? user.managedDojoIds?.[0];
    if (!id) throw new KasScopeError("Ranting kas tidak ditemukan");
    return { type: "dojo", id };
  }
  if (user.managedBranchId) {
    return { type: "branch", id: user.managedBranchId };
  }
  const branch = await prisma.branch.findFirst({
    where: { name: SITE_BRANCH_NAME, isDeleted: false },
    select: { id: true },
  });
  if (!branch) throw new KasScopeError("Cabang kas tidak ditemukan");
  return { type: "branch", id: branch.id };
}

export function canAccessKas(
  user: SessionUser,
  grants?: AdminDojoGrants | null,
): boolean {
  const role = getPrimaryAdminRole(user.roles ?? []);
  if (role !== "ADMIN_DOJO") return true;
  if (!grants) return true;
  return isAdminPathAllowedByGrants("/admin/kas", grants);
}

/** Tambah Kas: cukup menu Kas, tidak memakai grants.crud anggota. */
export function canWriteKas(
  user: SessionUser,
  grants?: AdminDojoGrants | null,
): boolean {
  return canAccessKas(user, grants);
}

export function canLockKasPeriod(user: SessionUser): boolean {
  const role = getPrimaryAdminRole(user.roles ?? []);
  return role !== "ADMIN_DOJO";
}

export async function isKasMonthLocked(
  scope: KasScope,
  ymd: string,
): Promise<boolean> {
  const yearMonth = yearMonthFromYmd(ymd);
  const row = await prisma.kasPeriodLock.findUnique({
    where: {
      scopeType_scopeId_yearMonth: {
        scopeType: scope.type,
        scopeId: scope.id,
        yearMonth,
      },
    },
  });
  return Boolean(row && !row.unlockedAt);
}

export async function assertKasMonthWritable(scope: KasScope, ymd: string) {
  if (await isKasMonthLocked(scope, ymd)) {
    throw new KasPeriodLockedError(yearMonthFromYmd(ymd));
  }
}

export type PostKasInput = {
  scope: KasScope;
  txnDate: string;
  description: string;
  kegiatan?: string;
  direction: KasDirection;
  amount: number;
  sourceType: KasSourceType;
  sourceId: string;
  sourceHref?: string | null;
  createdById?: string | null;
};

export async function postKasEntry(input: PostKasInput) {
  const amount = rupiahInt(input.amount);
  if (amount <= 0) throw new Error("Nominal kas harus lebih dari 0");
  const desc = input.description.trim();
  if (!desc) throw new Error("Keterangan wajib");
  await assertKasMonthWritable(input.scope, input.txnDate);

  const amountIn = input.direction === "in" ? amount : 0;
  const amountOut = input.direction === "out" ? amount : 0;
  const kegiatan = input.kegiatan?.trim() ?? "";

  try {
    const row = await prisma.kasEntry.create({
      data: {
        scopeType: input.scope.type,
        scopeId: input.scope.id,
        txnDate: parseYmd(input.txnDate),
        description: desc.slice(0, 500),
        kegiatan: kegiatan.slice(0, 120),
        amountIn,
        amountOut,
        sourceType: input.sourceType,
        sourceId: input.sourceId.slice(0, 180),
        sourceHref: input.sourceHref?.slice(0, 300) ?? null,
        createdById: input.createdById ?? null,
      },
    });
    return { row, created: true as const };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existing = await prisma.kasEntry.findUnique({
        where: {
          sourceType_sourceId_scopeId: {
            sourceType: input.sourceType,
            sourceId: input.sourceId,
            scopeId: input.scope.id,
          },
        },
      });
      if (existing) return { row: existing, created: false as const };
    }
    throw error;
  }
}

export async function postKasBatch(
  inputs: PostKasInput[],
): Promise<{ created: number }> {
  if (inputs.length === 0) return { created: 0 };
  return prisma.$transaction(async () => {
    let created = 0;
    for (const input of inputs) {
      const result = await postKasEntry(input);
      if (result.created) created += 1;
    }
    return { created };
  });
}

export async function voidKasBySource(opts: {
  sourceType: KasSourceType;
  sourceId: string;
  actorUserId?: string | null;
}) {
  const rows = await prisma.kasEntry.findMany({
    where: { sourceType: opts.sourceType, sourceId: opts.sourceId },
  });
  for (const row of rows) {
    const scope: KasScope = {
      type: row.scopeType as KasScope["type"],
      id: row.scopeId,
    };
    const direction: KasDirection = row.amountIn > 0 ? "out" : "in";
    const amount = row.amountIn > 0 ? row.amountIn : row.amountOut;
    if (amount <= 0) continue;
    await postKasEntry({
      scope,
      txnDate: ymdWib(),
      description: `Balik: ${row.description}`,
      kegiatan: row.kegiatan,
      direction,
      amount,
      sourceType: "void",
      sourceId: `void:${row.id}`,
      sourceHref: row.sourceHref,
      createdById: opts.actorUserId,
    });
  }
}

export async function listKasEntries(scope: KasScope) {
  const rows = await prisma.kasEntry.findMany({
    where: { scopeType: scope.type, scopeId: scope.id },
    orderBy: [{ txnDate: "asc" }, { createdAt: "asc" }],
  });
  return rows.map((row) => ({
    id: row.id,
    txnDate: row.txnDate.toISOString().slice(0, 10),
    description: row.description,
    kegiatan: row.kegiatan,
    amountIn: row.amountIn,
    amountOut: row.amountOut,
    createdAt: row.createdAt.toISOString(),
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    sourceHref: row.sourceHref,
    reconStatus: row.reconStatus,
  }));
}

export async function setKasRecon(id: string, scope: KasScope, reconStatus: "open" | "matched") {
  const updated = await prisma.kasEntry.updateMany({
    where: { id, scopeType: scope.type, scopeId: scope.id },
    data: { reconStatus },
  });
  return updated.count > 0;
}

export async function deleteManualKas(id: string, scope: KasScope) {
  const row = await prisma.kasEntry.findFirst({
    where: { id, scopeType: scope.type, scopeId: scope.id, sourceType: "manual" },
  });
  if (!row) return false;
  await assertKasMonthWritable(scope, row.txnDate.toISOString().slice(0, 10));
  await prisma.kasEntry.delete({ where: { id } });
  return true;
}

export async function updateManualKas(
  id: string,
  scope: KasScope,
  patch: {
    txnDate?: string;
    description?: string;
    kegiatan?: string;
    direction?: KasDirection;
    amount?: number;
  },
) {
  const row = await prisma.kasEntry.findFirst({
    where: { id, scopeType: scope.type, scopeId: scope.id, sourceType: "manual" },
  });
  if (!row) return null;
  const txnDate = patch.txnDate ?? row.txnDate.toISOString().slice(0, 10);
  await assertKasMonthWritable(scope, row.txnDate.toISOString().slice(0, 10));
  await assertKasMonthWritable(scope, txnDate);
  const amount = patch.amount != null ? rupiahInt(patch.amount) : row.amountIn || row.amountOut;
  const direction: KasDirection =
    patch.direction ?? (row.amountIn > 0 ? "in" : "out");
  return prisma.kasEntry.update({
    where: { id },
    data: {
      txnDate: parseYmd(txnDate),
      description: (patch.description ?? row.description).trim().slice(0, 500),
      kegiatan: (patch.kegiatan ?? row.kegiatan).trim().slice(0, 120),
      amountIn: direction === "in" ? amount : 0,
      amountOut: direction === "out" ? amount : 0,
    },
  });
}

export async function listKasLocks(scope: KasScope) {
  return prisma.kasPeriodLock.findMany({
    where: { scopeType: scope.type, scopeId: scope.id },
    orderBy: { yearMonth: "desc" },
  });
}

export async function setKasPeriodLock(opts: {
  scope: KasScope;
  yearMonth: string;
  lock: boolean;
  userId: string;
  reason?: string;
  token?: string | null;
  email?: string | null;
}) {
  if (!/^\d{4}-\d{2}$/.test(opts.yearMonth)) {
    throw new Error("Periode tidak valid");
  }
  if (opts.lock) {
    await prisma.kasPeriodLock.upsert({
      where: {
        scopeType_scopeId_yearMonth: {
          scopeType: opts.scope.type,
          scopeId: opts.scope.id,
          yearMonth: opts.yearMonth,
        },
      },
      create: {
        scopeType: opts.scope.type,
        scopeId: opts.scope.id,
        yearMonth: opts.yearMonth,
        lockedById: opts.userId,
      },
      update: {
        lockedAt: new Date(),
        lockedById: opts.userId,
        unlockedAt: null,
        unlockReason: null,
      },
    });
  } else {
    await prisma.kasPeriodLock.updateMany({
      where: {
        scopeType: opts.scope.type,
        scopeId: opts.scope.id,
        yearMonth: opts.yearMonth,
      },
      data: {
        unlockedAt: new Date(),
        unlockReason: (opts.reason ?? "").slice(0, 300),
      },
    });
  }
  writeAuditLog({
    userId: opts.userId,
    email: opts.email,
    action: opts.lock ? "KAS_LOCK" : "KAS_UNLOCK",
    details: `${opts.scope.type}:${opts.scope.id} ${opts.yearMonth}`,
    token: opts.token,
  });
}

export async function resolveDojoBranchScope(dojoId: string): Promise<{
  dojo: KasScope;
  branch: KasScope | null;
}> {
  const dojo = await prisma.dojo.findFirst({
    where: { id: dojoId, isDeleted: false },
    select: { id: true, branchId: true },
  });
  if (!dojo) return { dojo: { type: "dojo", id: dojoId }, branch: null };
  return {
    dojo: { type: "dojo", id: dojo.id },
    branch: dojo.branchId ? { type: "branch", id: dojo.branchId } : null,
  };
}
