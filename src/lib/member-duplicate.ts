import { prisma } from "@/lib/prisma";
import { surabayaDojoWhere } from "@/lib/security/branch-scope";
import {
  birthDateDayRange,
  normalizeMemberName,
  type DuplicateHit,
  type DuplicateMatchReason,
} from "@/lib/member-duplicate-utils";

export type { DuplicateHit, DuplicateMatchReason } from "@/lib/member-duplicate-utils";
export {
  activeHardDuplicates,
  archivedIdentityConflicts,
  birthDateDayRange,
  formatDuplicateError,
  hardDuplicates,
  normalizeMemberName,
  releasableArchivedIdConflicts,
} from "@/lib/member-duplicate-utils";

export type DuplicateCheckInput = {
  fullName?: string | null;
  birthDate?: string | null;
  nik?: string | null;
  nia?: string | null;
  /** Abaikan anggota ini (saat edit). */
  excludeMemberId?: string | null;
};

type Row = {
  id: string;
  fullName: string;
  nia: string | null;
  nik: string | null;
  status: string;
  isDeleted: boolean;
  birthDate: Date | null;
  userId: string | null;
  dojo: { name: string } | null;
};

function toHit(row: Row, reasons: DuplicateMatchReason[]): DuplicateHit {
  const hardReasons = reasons.filter((r) => r !== "NAME");
  return {
    id: row.id,
    fullName: row.fullName,
    nia: row.nia,
    status: row.status,
    dojoName: row.dojo?.name ?? null,
    hasAccount: Boolean(row.userId),
    isArchived: row.isDeleted,
    reasons,
    severity: hardReasons.length > 0 ? "hard" : "soft",
  };
}

function mergeHits(map: Map<string, DuplicateHit>, row: Row, reasons: DuplicateMatchReason[]) {
  const existing = map.get(row.id);
  if (!existing) {
    map.set(row.id, toHit(row, reasons));
    return;
  }
  const merged = Array.from(new Set([...existing.reasons, ...reasons]));
  map.set(row.id, toHit(row, merged));
}

const memberSelect = {
  id: true,
  fullName: true,
  nia: true,
  nik: true,
  status: true,
  isDeleted: true,
  birthDate: true,
  userId: true,
  dojo: { select: { name: true } },
} as const;

/**
 * Cari duplikat anggota di Cabang Surabaya.
 * Keras: NIK, NIA, atau nama tepat + tanggal lahir (termasuk arsip untuk NIK/NIA).
 * Lunak: kemiripan nama aktif (untuk peringatan UI).
 */
export async function findMemberDuplicates(
  input: DuplicateCheckInput,
): Promise<DuplicateHit[]> {
  const nik = input.nik?.trim() || "";
  const nia = input.nia?.trim().toUpperCase() || "";
  const fullName = input.fullName ? normalizeMemberName(input.fullName) : "";
  const birthRange = input.birthDate ? birthDateDayRange(input.birthDate) : null;
  const excludeId = input.excludeMemberId?.trim() || undefined;

  const scopeWhere = {
    dojo: surabayaDojoWhere,
    ...(excludeId ? { id: { not: excludeId } } : {}),
  };

  const map = new Map<string, DuplicateHit>();

  if (nik && /^\d{16}$/.test(nik)) {
    // NIK unik juga di arsip — Inkai tetap menolak jika nomor masih terpakai.
    const rows = await prisma.member.findMany({
      where: { ...scopeWhere, nik },
      select: memberSelect,
      take: 5,
    });
    for (const row of rows) mergeHits(map, row, ["NIK"]);
  }

  if (nia.length >= 2) {
    const rows = await prisma.member.findMany({
      where: {
        ...scopeWhere,
        nia: { equals: nia, mode: "insensitive" },
      },
      select: memberSelect,
      take: 5,
    });
    for (const row of rows) mergeHits(map, row, ["NIA"]);
  }

  if (fullName.length >= 2 && birthRange) {
    const rows = await prisma.member.findMany({
      where: {
        ...scopeWhere,
        fullName: { equals: fullName, mode: "insensitive" },
        birthDate: { gte: birthRange.gte, lt: birthRange.lt },
      },
      select: memberSelect,
      take: 5,
    });
    for (const row of rows) mergeHits(map, row, ["NAME_BIRTHDATE"]);
  }

  if (fullName.length >= 3) {
    const rows = await prisma.member.findMany({
      where: {
        ...scopeWhere,
        isDeleted: false,
        fullName: { contains: fullName, mode: "insensitive" },
      },
      select: memberSelect,
      take: 8,
    });
    for (const row of rows) {
      mergeHits(map, row, ["NAME"]);
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "hard" ? -1 : 1;
    if (a.isArchived !== b.isArchived) return a.isArchived ? 1 : -1;
    return a.fullName.localeCompare(b.fullName);
  });
}

/**
 * Lepas NIA/NIK dari anggota arsip agar bisa dipakai ulang (Prisma + Inkai).
 */
export async function releaseIdentifiersFromArchivedMembers(opts: {
  hits: DuplicateHit[];
  token: string;
}): Promise<void> {
  const { inkaiFetch } = await import("@/lib/inkai-api/server");
  const releasable = opts.hits.filter(
    (h) =>
      h.isArchived &&
      (h.reasons.includes("NIA") || h.reasons.includes("NIK")),
  );

  for (const hit of releasable) {
    const clearNia = hit.reasons.includes("NIA");
    const clearNik = hit.reasons.includes("NIK");
    if (!clearNia && !clearNik) continue;

    await prisma.member.update({
      where: { id: hit.id },
      data: {
        ...(clearNia ? { nia: null } : {}),
        ...(clearNik ? { nik: null } : {}),
      },
    });

    const body: Record<string, null> = {};
    if (clearNia) body.nia = null;
    if (clearNik) body.nik = null;

    // Inkai mungkin masih menahan unique NIA setelah soft-delete lokal.
    const { res } = await inkaiFetch(
      `/v1/members/${hit.id}`,
      { method: "PATCH", body: JSON.stringify(body) },
      opts.token,
    );
    if (!res.ok) {
      // Coba hapus permanen di Inkai jika PATCH gagal (sudah arsip lokal).
      await inkaiFetch(
        `/v1/members/${hit.id}`,
        { method: "DELETE" },
        opts.token,
      );
    }
  }
}
