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
  dojo: {
    name: string;
    branch: { name: string } | null;
  } | null;
};

function toHit(row: Row, reasons: DuplicateMatchReason[]): DuplicateHit {
  const hardReasons = reasons.filter((r) => r !== "NAME");
  return {
    id: row.id,
    fullName: row.fullName,
    nia: row.nia,
    status: row.status,
    dojoName: row.dojo?.name ?? null,
    branchName: row.dojo?.branch?.name ?? null,
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
  dojo: {
    select: {
      name: true,
      branch: { select: { name: true } },
    },
  },
} as const;

/**
 * Cari pemilik NIA di seluruh sistem (unik global di Inkai), termasuk arsip.
 */
export async function findMembersByNia(
  niaRaw: string,
  excludeMemberId?: string | null,
): Promise<DuplicateHit[]> {
  const nia = niaRaw.trim().toUpperCase();
  if (nia.length < 2) return [];
  const rows = await prisma.member.findMany({
    where: {
      nia: { equals: nia, mode: "insensitive" },
      ...(excludeMemberId ? { id: { not: excludeMemberId } } : {}),
    },
    select: memberSelect,
    take: 5,
  });
  return rows.map((row) => toHit(row, ["NIA"]));
}

/**
 * Cari duplikat anggota.
 * NIK/NIA: cakupan global (unique di Inkai) termasuk arsip.
 * Nama+TTL / nama: cakupan Cabang Surabaya.
 */
export async function findMemberDuplicates(
  input: DuplicateCheckInput,
): Promise<DuplicateHit[]> {
  const nik = input.nik?.trim() || "";
  const nia = input.nia?.trim().toUpperCase() || "";
  const fullName = input.fullName ? normalizeMemberName(input.fullName) : "";
  const birthRange = input.birthDate ? birthDateDayRange(input.birthDate) : null;
  const excludeId = input.excludeMemberId?.trim() || undefined;

  const surabayaWhere = {
    dojo: surabayaDojoWhere,
    ...(excludeId ? { id: { not: excludeId } } : {}),
  };

  const map = new Map<string, DuplicateHit>();

  if (nik && /^\d{16}$/.test(nik)) {
    // NIK unik global — termasuk arsip & lintas cabang.
    const rows = await prisma.member.findMany({
      where: {
        nik,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: memberSelect,
      take: 5,
    });
    for (const row of rows) mergeHits(map, row, ["NIK"]);
  }

  if (nia.length >= 2) {
    const hits = await findMembersByNia(nia, excludeId);
    for (const hit of hits) {
      const existing = map.get(hit.id);
      if (!existing) {
        map.set(hit.id, hit);
      } else {
        map.set(hit.id, {
          ...existing,
          reasons: Array.from(new Set([...existing.reasons, "NIA" as const])),
          severity: "hard",
        });
      }
    }
  }

  if (fullName.length >= 2 && birthRange) {
    const rows = await prisma.member.findMany({
      where: {
        ...surabayaWhere,
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
        ...surabayaWhere,
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

/** Perkaya pesan error Inkai "NIA sudah digunakan" dengan nama pemilik. */
export async function enrichNiaConflictError(
  rawError: string,
  nia: string | undefined,
  knownHits: DuplicateHit[] = [],
): Promise<string> {
  if (!nia || !/nia/i.test(rawError)) return rawError;

  let hits = knownHits.filter((h) => h.reasons.includes("NIA"));
  if (hits.length === 0) {
    hits = await findMembersByNia(nia);
  }
  if (hits.length === 0) {
    return `${rawError} (NIA ${nia.trim().toUpperCase()} — pemilik tidak ditemukan di database lokal; cek arsip / cabang lain di Inkai).`;
  }

  const { formatDuplicateError } = await import("@/lib/member-duplicate-utils");
  return formatDuplicateError(hits, "admin");
}
