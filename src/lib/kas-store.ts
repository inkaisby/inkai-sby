import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import {
  buildBranchFilter,
  buildDojoFilter,
  getPrimaryAdminRole,
  type SessionUser,
} from "@/lib/rbac";
import { SITE_BRANCH_NAME } from "@/lib/site";
import type { AdminDojoGrants } from "@/lib/admin-dojo-grants";
import { isAdminPathAllowedByGrants } from "@/lib/admin-dojo-grants";
import {
  getKasBaseKegiatan,
  parseYmd,
  rupiahInt,
  yearMonthFromYmd,
  ymdWib,
  type KasDirection,
  type KasScope,
  type KasSourceType,
} from "@/lib/kas";
import { formatLatberKasKegiatan, formatUktKasKegiatan } from "@/lib/kas-kegiatan";

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

export function canTransferKas(user: SessionUser): boolean {
  return canLockKasPeriod(user);
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
      if (existing) {
        await assertKasMonthWritable(input.scope, input.txnDate);
        const updatedRow = await prisma.kasEntry.update({
          where: { id: existing.id },
          data: {
            txnDate: parseYmd(input.txnDate),
            description: desc.slice(0, 500),
            kegiatan: kegiatan.slice(0, 120),
            amountIn,
            amountOut,
          },
        });
        return { row: updatedRow, created: false as const };
      }
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

function normalizeKasDisplayAmount(amount: number, sourceType: string, description: string): number {
  if (amount <= 0) return 0;
  const isUktOrLatber =
    sourceType === "ukt" ||
    sourceType === "latber" ||
    /\bUKT\b/i.test(description) ||
    /latihan bersama/i.test(description) ||
    /\blatber\b/i.test(description);
  if (isUktOrLatber) {
    return amount - (amount % 1000);
  }
  return amount;
}

function normalizeKasKegiatan(kegiatan: string, dojoName?: string | null): string {
  if (!kegiatan) return kegiatan;
  const dojo = dojoName?.trim();
  if (dojo && /persiapan\s*ukt-ranting$/i.test(kegiatan)) {
    return kegiatan.replace(/-ranting$/i, `-${dojo}`);
  }
  return kegiatan;
}

async function syncMissingLatberKasForScope(scope: KasScope) {
  try {
    const paidLatberBillings = await prisma.billing.findMany({
      where: {
        isDeleted: false,
        status: { in: ["PAID", "SUCCESS"] },
        ...(scope.type === "dojo"
          ? { member: { dojoId: scope.id } }
          : { member: { dojo: { branchId: scope.id } } }),
        OR: [
          { description: { contains: "Latber", mode: "insensitive" } },
          { description: { contains: "Latihan Bersama", mode: "insensitive" } },
        ],
      },
      include: {
        member: {
          select: {
            id: true,
            isDeleted: true,
            dojoId: true,
            fullName: true,
            nia: true,
            dojo: { select: { id: true, branchId: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const regIds = paidLatberBillings
      .map((b) => b.registrationId)
      .filter((id): id is string => Boolean(id));

    const activeRegs =
      regIds.length > 0
        ? await prisma.eventRegistration.findMany({
            where: {
              id: { in: regIds },
              status: { notIn: ["REJECTED", "CANCELLED"] },
            },
            select: { id: true, status: true, eventId: true },
          })
        : [];

    const activeRegMap = new Map(activeRegs.map((r) => [r.id, r]));

    const existingLatberKasEntries = await prisma.kasEntry.findMany({
      where: {
        scopeType: scope.type,
        scopeId: scope.id,
        sourceType: "latber",
      },
      select: { id: true, sourceId: true },
    });

    const validSourceIds = new Set<string>();
    const seenRegIds = new Set<string>();

    for (const b of paidLatberBillings) {
      const desc = b.description ?? "";
      const isLatber =
        (/latber/i.test(desc) || /latihan bersama/i.test(desc)) &&
        !/^UKT\b/i.test(desc);
      if (!isLatber || !b.member?.dojoId || b.member.isDeleted) continue;

      if (b.registrationId) {
        const reg = activeRegMap.get(b.registrationId);
        if (!reg) {
          continue;
        }
        if (seenRegIds.has(b.registrationId)) {
          continue;
        }
        seenRegIds.add(b.registrationId);
      }

      if (scope.type === "dojo") {
        const sourceId = `${b.id}:ranting`;
        validSourceIds.add(sourceId);
        const exists = existingLatberKasEntries.some((e) => e.sourceId === sourceId);
        if (!exists) {
          const nia = b.member.nia ? ` (${b.member.nia})` : "";
          const descStr = `${b.member.fullName}${nia}`;
          const kegiatan = formatLatberKasKegiatan(
            b.description || "Latber Persiapan UKT",
            b.member.dojo?.name,
          );
          await prisma.kasEntry.create({
            data: {
              scopeType: "dojo",
              scopeId: b.member.dojoId,
              txnDate: b.createdAt,
              description: `CASHBACK ranting — ${descStr}`,
              kegiatan,
              amountIn: 5000,
              amountOut: 0,
              sourceType: "latber",
              sourceId,
              sourceHref: "/admin/latber",
            },
          });
        }
      } else if (scope.type === "branch" && b.member.dojo?.branchId) {
        const sourceId = `${b.id}:cabang`;
        validSourceIds.add(sourceId);
        const exists = existingLatberKasEntries.some((e) => e.sourceId === sourceId);
        if (!exists) {
          const nia = b.member.nia ? ` (${b.member.nia})` : "";
          const descStr = `${b.member.fullName}${nia}`;
          const kegiatan = formatLatberKasKegiatan(
            b.description || "Latber Persiapan UKT",
            b.member.dojo?.name,
          );
          await prisma.kasEntry.create({
            data: {
              scopeType: "branch",
              scopeId: b.member.dojo.branchId,
              txnDate: b.createdAt,
              description: descStr,
              kegiatan,
              amountIn: 40000,
              amountOut: 0,
              sourceType: "latber",
              sourceId,
              sourceHref: "/admin/latber",
            },
          });
        }
      }
    }

    const staleIds = existingLatberKasEntries
      .filter((e) => !validSourceIds.has(e.sourceId))
      .map((e) => e.id);

    if (staleIds.length > 0) {
      await prisma.kasEntry.deleteMany({
        where: { id: { in: staleIds } },
      });
    }

    if (scope.type === "branch") {
      await prisma.kasEntry.updateMany({
        where: {
          scopeType: "branch",
          sourceType: "latber",
          amountIn: { gt: 40000 },
        },
        data: {
          amountIn: 40000,
        },
      });
    }
  } catch (e) {
    console.error("[KAS AUTO-SYNC] Latber kas sync error", e);
  }
}

async function syncMissingUktKasForScope(scope: KasScope) {
  try {
    const paidUktBillings = await prisma.billing.findMany({
      where: {
        isDeleted: false,
        status: { in: ["PAID", "SUCCESS"] },
        ...(scope.type === "dojo"
          ? { member: { dojoId: scope.id } }
          : { member: { dojo: { branchId: scope.id } } }),
        OR: [
          { type: { contains: "UKT", mode: "insensitive" } },
          { description: { contains: "UKT", mode: "insensitive" } },
        ],
      },
      include: {
        member: {
          select: {
            id: true,
            isDeleted: true,
            dojoId: true,
            fullName: true,
            nia: true,
            dojo: { select: { id: true, branchId: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const regIds = paidUktBillings
      .map((b) => b.registrationId)
      .filter((id): id is string => Boolean(id));

    const activeRegs =
      regIds.length > 0
        ? await prisma.eventRegistration.findMany({
            where: {
              id: { in: regIds },
              status: { notIn: ["REJECTED", "CANCELLED"] },
            },
            select: { id: true, status: true, eventId: true },
          })
        : [];

    const activeRegMap = new Map(activeRegs.map((r) => [r.id, r]));

    const existingUktKasEntries = await prisma.kasEntry.findMany({
      where: {
        scopeType: scope.type,
        scopeId: scope.id,
        sourceType: "ukt",
      },
      select: { id: true, sourceId: true },
    });

    const validSourceIds = new Set<string>();
    const seenRegIds = new Set<string>();

    for (const b of paidUktBillings) {
      const desc = b.description ?? "";
      const isUkt = /\bUKT\b/i.test(desc) || /\bUKT\b/i.test(b.type ?? "");
      if (!isUkt || !b.member?.dojoId || b.member.isDeleted) continue;

      if (b.registrationId) {
        const reg = activeRegMap.get(b.registrationId);
        if (!reg) {
          continue;
        }
        if (seenRegIds.has(b.registrationId)) {
          continue;
        }
        seenRegIds.add(b.registrationId);
      }

      if (scope.type === "branch" && b.member.dojo?.branchId) {
        const sourceId = b.id;
        validSourceIds.add(sourceId);
        validSourceIds.add(`${b.id}:cabang`);
        const exists = existingUktKasEntries.some(
          (e) => e.sourceId === sourceId || e.sourceId === `${b.id}:cabang`,
        );
        if (!exists) {
          const nia = b.member.nia ? ` (${b.member.nia})` : "";
          const descStr = `${b.member.fullName}${nia}`;
          const kegiatan = formatUktKasKegiatan(
            b.description || "UKT",
            b.member.dojo?.name,
          );
          const fee = b.amount - (b.amount % 1000);
          const komisi = Math.min(fee, 50000);
          const nett = Math.max(0, fee - komisi);
          await prisma.kasEntry.create({
            data: {
              scopeType: "branch",
              scopeId: b.member.dojo.branchId,
              txnDate: b.createdAt,
              description: descStr,
              kegiatan,
              amountIn: nett,
              amountOut: 0,
              sourceType: "ukt",
              sourceId,
              sourceHref: "/admin/ukt",
            },
          });
        }
      }
    }

    const staleIds = existingUktKasEntries
      .filter(
        (e) =>
          !validSourceIds.has(e.sourceId) &&
          !validSourceIds.has(e.sourceId.replace(/:cabang$/, "")),
      )
      .map((e) => e.id);

    if (staleIds.length > 0) {
      await prisma.kasEntry.deleteMany({
        where: { id: { in: staleIds } },
      });
    }
  } catch (e) {
    console.error("[KAS AUTO-SYNC] UKT kas sync error", e);
  }
}

export async function deleteKasByKegiatan(opts: {
  scope: KasScope;
  kegiatan: string;
  user: SessionUser;
  email?: string | null;
  token?: string | null;
}): Promise<{ deleted: number }> {
  const kegiatan = opts.kegiatan.trim();
  if (!kegiatan) {
    throw new Error("Nama kegiatan wajib diisi");
  }

  let dojoName: string | null = null;
  if (opts.scope.type === "dojo") {
    const dojo = await prisma.dojo.findFirst({
      where: { id: opts.scope.id },
      select: { name: true },
    });
    dojoName = dojo?.name?.trim() || null;
  }

  const allRows = await prisma.kasEntry.findMany({
    where: {
      scopeType: opts.scope.type,
      scopeId: opts.scope.id,
    },
  });

  const targetK = kegiatan.toLowerCase();
  const rows = allRows.filter((row) => {
    const rawK = row.kegiatan.trim().toLowerCase();
    const normalizedK = normalizeKasKegiatan(row.kegiatan, dojoName).trim().toLowerCase();
    const baseK = getKasBaseKegiatan(row.kegiatan, row.sourceType).trim().toLowerCase();

    return (
      rawK === targetK ||
      normalizedK === targetK ||
      baseK === targetK ||
      rawK.startsWith(targetK + "-") ||
      rawK.startsWith(targetK + " -") ||
      normalizedK.startsWith(targetK + "-") ||
      normalizedK.startsWith(targetK + " -") ||
      baseK.startsWith(targetK + "-") ||
      baseK.startsWith(targetK + " -")
    );
  });

  const uniqueDates = Array.from(new Set(rows.map((r) => r.txnDate.toISOString().slice(0, 10))));
  for (const txnDate of uniqueDates) {
    await assertKasMonthWritable(opts.scope, txnDate);
  }

  await prisma.kasEntry.deleteMany({
    where: { id: { in: rows.map((r) => r.id) } },
  });

  writeAuditLog({
    userId: opts.user.id,
    email: opts.email,
    action: "KAS_DELETE_KEGIATAN",
    details: `${kegiatan} x${rows.length} ${opts.scope.type}:${opts.scope.id}`,
    token: opts.token,
  });

  return { deleted: rows.length };
}

export async function listKasEntries(scope: KasScope) {
  // Auto-sync dinonaktifkan agar pembukuan Kas murni dikelola secara manual oleh pengurus
  // await syncMissingLatberKasForScope(scope);
  // await syncMissingUktKasForScope(scope);
  let dojoName: string | null = null;
  if (scope.type === "dojo") {
    const dojo = await prisma.dojo.findFirst({
      where: { id: scope.id },
      select: { name: true },
    });
    dojoName = dojo?.name?.trim() || null;
  }
  const rows = await prisma.kasEntry.findMany({
    where: { scopeType: scope.type, scopeId: scope.id },
    orderBy: [{ txnDate: "asc" }, { createdAt: "asc" }],
  });
  return rows.map((row) => ({
    id: row.id,
    txnDate: row.txnDate.toISOString().slice(0, 10),
    description: row.description,
    kegiatan: normalizeKasKegiatan(row.kegiatan, dojoName),
    amountIn: normalizeKasDisplayAmount(row.amountIn, row.sourceType, row.description),
    amountOut: normalizeKasDisplayAmount(row.amountOut, row.sourceType, row.description),
    createdAt: row.createdAt.toISOString(),
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    sourceHref: row.sourceHref,
    reconStatus: row.reconStatus,
  }));
}

export async function listKasScopes(user: SessionUser): Promise<
  Array<{ type: "branch" | "dojo"; id: string; label: string }>
> {
  const role = getPrimaryAdminRole(user.roles ?? []);
  if (role === "ADMIN_DOJO") {
    const scope = await resolveKasScope(user);
    return [{ type: scope.type, id: scope.id, label: "Ranting" }];
  }

  const out: Array<{ type: "branch" | "dojo"; id: string; label: string }> = [];
  const branches = await prisma.branch.findMany({
    where: buildBranchFilter(user),
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  for (const branch of branches) {
    out.push({
      type: "branch",
      id: branch.id,
      label: `Cabang ${branch.name || "Surabaya"}`,
    });
  }

  const dojos = await prisma.dojo.findMany({
    where: buildDojoFilter(user),
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  for (const dojo of dojos) {
    out.push({
      type: "dojo",
      id: dojo.id,
      label: `Ranting ${dojo.name || "Tanpa nama"}`,
    });
  }
  return out;
}

export async function resolveKasScopeForView(
  user: SessionUser,
  override?: { type?: string | null; id?: string | null },
): Promise<KasScope> {
  const fallback = await resolveKasScope(user);
  const type = override?.type === "branch" || override?.type === "dojo" ? override.type : null;
  const id = override?.id?.trim() || null;
  if (!type || !id || !canTransferKas(user)) return fallback;

  const allowed = await listKasScopes(user);
  const match = allowed.find((s) => s.type === type && s.id === id);
  if (!match) throw new KasScopeError("Buku kas di luar wilayah Anda");
  return { type, id };
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
    where: { id, scopeType: scope.type, scopeId: scope.id },
  });
  if (!row) return false;
  await assertKasMonthWritable(scope, row.txnDate.toISOString().slice(0, 10));
  await prisma.kasEntry.delete({ where: { id } });
  return true;
}

export async function deleteKasBySource(
  sourceType: KasSourceType,
  sourceId: string,
  scope: KasScope,
) {
  const row = await prisma.kasEntry.findFirst({
    where: { sourceType, sourceId, scopeType: scope.type, scopeId: scope.id },
  });
  if (!row) return false;
  await assertKasMonthWritable(scope, row.txnDate.toISOString().slice(0, 10));
  await prisma.kasEntry.delete({ where: { id: row.id } });
  return true;
}

export async function deleteManualKasByIds(opts: {
  ids: string[];
  scope: KasScope;
  user: SessionUser;
  token?: string | null;
  email?: string | null;
}): Promise<{ deleted: number }> {
  const ids = [...new Set(opts.ids.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) return { deleted: 0 };
  if (ids.length > 100) {
    throw new Error("Maksimal 100 baris per penghapusan");
  }

  const rows = await prisma.kasEntry.findMany({
    where: {
      id: { in: ids },
      scopeType: opts.scope.type,
      scopeId: opts.scope.id,
    },
  });
  if (rows.length === 0) return { deleted: 0 };

  const uniqueDates = Array.from(new Set(rows.map((r) => r.txnDate.toISOString().slice(0, 10))));
  for (const txnDate of uniqueDates) {
    await assertKasMonthWritable(opts.scope, txnDate);
  }

  await prisma.kasEntry.deleteMany({
    where: { id: { in: rows.map((r) => r.id) } },
  });

  writeAuditLog({
    userId: opts.user.id,
    email: opts.email,
    action: "KAS_DELETE_BATCH",
    details: `x${rows.length} ${opts.scope.type}:${opts.scope.id}`,
    token: opts.token,
  });

  return { deleted: rows.length };
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
    where: { id, scopeType: scope.type, scopeId: scope.id },
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

export async function renameKasKegiatan(opts: {
  scope: KasScope;
  oldKegiatan: string;
  newKegiatan: string;
}): Promise<{ updated: number }> {
  const oldK = opts.oldKegiatan.trim();
  const newK = opts.newKegiatan.trim().slice(0, 120);
  if (!oldK || !newK) throw new Error("Nama kegiatan tidak valid");

  let dojoName: string | null = null;
  if (opts.scope.type === "dojo") {
    const dojo = await prisma.dojo.findFirst({
      where: { id: opts.scope.id },
      select: { name: true },
    });
    dojoName = dojo?.name?.trim() || null;
  }

  const rows = await prisma.kasEntry.findMany({
    where: { scopeType: opts.scope.type, scopeId: opts.scope.id },
  });

  const matchingIds: string[] = [];
  const oldKLower = oldK.toLowerCase();
  for (const row of rows) {
    const k = row.kegiatan.trim();
    const kLower = k.toLowerCase();
    const normalizedKLower = normalizeKasKegiatan(row.kegiatan, dojoName).trim().toLowerCase();
    const baseKLower = getKasBaseKegiatan(row.kegiatan, row.sourceType).trim().toLowerCase();

    if (
      kLower === oldKLower ||
      normalizedKLower === oldKLower ||
      baseKLower === oldKLower ||
      kLower.startsWith(oldKLower) ||
      normalizedKLower.startsWith(oldKLower) ||
      baseKLower.startsWith(oldKLower)
    ) {
      matchingIds.push(row.id);
    }
  }

  if (matchingIds.length === 0) return { updated: 0 };

  const result = await prisma.kasEntry.updateMany({
    where: { id: { in: matchingIds } },
    data: { kegiatan: newK },
  });

  return { updated: result.count };
}

export async function transferManualKas(opts: {
  id: string;
  sourceScope: KasScope;
  targetScope: KasScope;
  user: SessionUser;
  token?: string | null;
  email?: string | null;
}) {
  if (!canTransferKas(opts.user)) {
    throw new Error("Tidak berhak memindahkan lokasi kas");
  }
  if (
    opts.sourceScope.type === opts.targetScope.type &&
    opts.sourceScope.id === opts.targetScope.id
  ) {
    throw new Error("Buku tujuan sama dengan buku asal");
  }

  const row = await prisma.kasEntry.findFirst({
    where: {
      id: opts.id,
      scopeType: opts.sourceScope.type,
      scopeId: opts.sourceScope.id,
    },
  });
  if (!row) return null;

  const allowed = await listKasScopes(opts.user);
  const targetAllowed = allowed.some(
    (s) => s.type === opts.targetScope.type && s.id === opts.targetScope.id,
  );
  if (!targetAllowed) {
    throw new KasScopeError("Buku tujuan di luar wilayah Anda");
  }

  const txnDate = row.txnDate.toISOString().slice(0, 10);
  await assertKasMonthWritable(opts.targetScope, txnDate);

  const updated = await prisma.kasEntry.update({
    where: { id: row.id },
    data: {
      scopeType: opts.targetScope.type,
      scopeId: opts.targetScope.id,
    },
  });

  writeAuditLog({
    userId: opts.user.id,
    email: opts.email,
    action: "KAS_TRANSFER",
    details:
      `${row.id} ${opts.sourceScope.type}:${opts.sourceScope.id}` +
      ` -> ${opts.targetScope.type}:${opts.targetScope.id}`,
    token: opts.token,
  });

  return updated;
}

export async function transferManualKasByKegiatan(opts: {
  sourceScope: KasScope;
  targetScope: KasScope;
  kegiatan: string;
  user: SessionUser;
  token?: string | null;
  email?: string | null;
}): Promise<{ moved: number }> {
  if (!canTransferKas(opts.user)) {
    throw new Error("Tidak berhak memindahkan lokasi kas");
  }
  const kegiatan = opts.kegiatan.trim();
  if (!kegiatan) {
    throw new Error("Kegiatan wajib");
  }
  if (
    opts.sourceScope.type === opts.targetScope.type &&
    opts.sourceScope.id === opts.targetScope.id
  ) {
    throw new Error("Buku tujuan sama dengan buku asal");
  }

  const allowed = await listKasScopes(opts.user);
  const targetAllowed = allowed.some(
    (s) => s.type === opts.targetScope.type && s.id === opts.targetScope.id,
  );
  if (!targetAllowed) {
    throw new KasScopeError("Buku tujuan di luar wilayah Anda");
  }

  let dojoName: string | null = null;
  if (opts.sourceScope.type === "dojo") {
    const dojo = await prisma.dojo.findFirst({
      where: { id: opts.sourceScope.id },
      select: { name: true },
    });
    dojoName = dojo?.name?.trim() || null;
  }

  const allRows = await prisma.kasEntry.findMany({
    where: {
      scopeType: opts.sourceScope.type,
      scopeId: opts.sourceScope.id,
    },
    orderBy: [{ txnDate: "asc" }, { createdAt: "asc" }],
  });

  const targetK = kegiatan.toLowerCase();
  const rows = allRows.filter((row) => {
    const rawK = row.kegiatan.trim().toLowerCase();
    const normalizedK = normalizeKasKegiatan(row.kegiatan, dojoName).trim().toLowerCase();
    const baseK = getKasBaseKegiatan(row.kegiatan, row.sourceType).trim().toLowerCase();

    return (
      rawK === targetK ||
      normalizedK === targetK ||
      baseK === targetK ||
      rawK.startsWith(targetK + "-") ||
      rawK.startsWith(targetK + " -") ||
      normalizedK.startsWith(targetK + "-") ||
      normalizedK.startsWith(targetK + " -") ||
      baseK.startsWith(targetK + "-") ||
      baseK.startsWith(targetK + " -")
    );
  });
  if (rows.length === 0) {
    return { moved: 0 };
  }

  const uniqueDates1 = Array.from(new Set(rows.map((r) => r.txnDate.toISOString().slice(0, 10))));
  for (const txnDate of uniqueDates1) {
    await assertKasMonthWritable(opts.targetScope, txnDate);
  }

  await prisma.kasEntry.updateMany({
    where: { id: { in: rows.map((r) => r.id) } },
    data: {
      scopeType: opts.targetScope.type,
      scopeId: opts.targetScope.id,
    },
  });

  writeAuditLog({
    userId: opts.user.id,
    email: opts.email,
    action: "KAS_TRANSFER_KEGIATAN",
    details:
      `${kegiatan} x${rows.length} ${opts.sourceScope.type}:${opts.sourceScope.id}` +
      ` -> ${opts.targetScope.type}:${opts.targetScope.id}`,
    token: opts.token,
  });

  return { moved: rows.length };
}

export async function transferManualKasByIds(opts: {
  ids: string[];
  sourceScope: KasScope;
  targetScope: KasScope;
  user: SessionUser;
  token?: string | null;
  email?: string | null;
}): Promise<{ moved: number }> {
  if (!canTransferKas(opts.user)) {
    throw new Error("Tidak berhak memindahkan lokasi kas");
  }
  const ids = [...new Set(opts.ids.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) {
    return { moved: 0 };
  }
  if (ids.length > 100) {
    throw new Error("Maksimal 100 baris per pemindahan");
  }
  if (
    opts.sourceScope.type === opts.targetScope.type &&
    opts.sourceScope.id === opts.targetScope.id
  ) {
    throw new Error("Buku tujuan sama dengan buku asal");
  }

  const allowed = await listKasScopes(opts.user);
  const targetAllowed = allowed.some(
    (s) => s.type === opts.targetScope.type && s.id === opts.targetScope.id,
  );
  if (!targetAllowed) {
    throw new KasScopeError("Buku tujuan di luar wilayah Anda");
  }

  const rows = await prisma.kasEntry.findMany({
    where: {
      id: { in: ids },
      scopeType: opts.sourceScope.type,
      scopeId: opts.sourceScope.id,
    },
    orderBy: [{ txnDate: "asc" }, { createdAt: "asc" }],
  });
  if (rows.length === 0) {
    return { moved: 0 };
  }

  const uniqueDates2 = Array.from(new Set(rows.map((r) => r.txnDate.toISOString().slice(0, 10))));
  for (const txnDate of uniqueDates2) {
    await assertKasMonthWritable(opts.targetScope, txnDate);
  }

  await prisma.kasEntry.updateMany({
    where: { id: { in: rows.map((r) => r.id) } },
    data: {
      scopeType: opts.targetScope.type,
      scopeId: opts.targetScope.id,
    },
  });

  writeAuditLog({
    userId: opts.user.id,
    email: opts.email,
    action: "KAS_TRANSFER_BATCH",
    details:
      `x${rows.length} ${opts.sourceScope.type}:${opts.sourceScope.id}` +
      ` -> ${opts.targetScope.type}:${opts.targetScope.id}`,
    token: opts.token,
  });

  return { moved: rows.length };
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
  dojoName: string | null;
}> {
  const dojo = await prisma.dojo.findFirst({
    where: { id: dojoId, isDeleted: false },
    select: { id: true, branchId: true, name: true },
  });
  if (!dojo) {
    return { dojo: { type: "dojo", id: dojoId }, branch: null, dojoName: null };
  }
  return {
    dojo: { type: "dojo", id: dojo.id },
    branch: dojo.branchId ? { type: "branch", id: dojo.branchId } : null,
    dojoName: dojo.name?.trim() || null,
  };
}
