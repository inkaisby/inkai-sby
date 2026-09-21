import { SessionUser, getPrimaryAdminRole } from "@/lib/rbac";

export type SekretarisScope = {
  scopeType: "PROVINCE" | "BRANCH" | "DOJO";
  scopeId: string;
};

/**
 * Resolves the primary scope for the current admin user.
 */
export function resolveSekretarisScope(user: SessionUser): SekretarisScope {
  const role = getPrimaryAdminRole(user.roles);

  if (role === "ADMIN_DOJO" && user.managedDojoId) {
    return { scopeType: "DOJO", scopeId: user.managedDojoId };
  }
  if (role === "ADMIN_PROVINCE" && user.managedProvinceId) {
    return { scopeType: "PROVINCE", scopeId: user.managedProvinceId };
  }
  if (user.managedBranchId) {
    return { scopeType: "BRANCH", scopeId: user.managedBranchId };
  }
  return { scopeType: "BRANCH", scopeId: "main" };
}

/**
 * Resolves human-readable scope label (e.g., "Cabang Surabaya", "Ranting Airlangga").
 */
export async function resolveSekretarisScopeLabel(
  user: SessionUser,
  prismaClient: any
): Promise<{ scopeType: string; scopeName: string }> {
  const scope = resolveSekretarisScope(user);

  if (scope.scopeType === "DOJO" && scope.scopeId) {
    try {
      const dojo = await prismaClient.dojo.findFirst({
        where: { id: scope.scopeId },
        select: { name: true },
      });
      return {
        scopeType: "DOJO",
        scopeName: dojo?.name ? `Ranting ${dojo.name}` : "Ranting",
      };
    } catch (e) {
      return { scopeType: "DOJO", scopeName: "Ranting" };
    }
  }

  if (scope.scopeType === "PROVINCE") {
    return { scopeType: "PROVINCE", scopeName: "Pengprov Jatim" };
  }

  return { scopeType: "BRANCH", scopeName: "Pengcab Surabaya" };
}

/**
 * Build Prisma filter for Surat / Dokumen / Notulen entries.
 */
export function buildSekretarisFilter(user: SessionUser) {
  const role = getPrimaryAdminRole(user.roles);

  if (role === "ADMINISTRATOR" || role === "ADMIN_PUSAT" || role === "ADMIN") {
    return {};
  }
  if (role === "ADMIN_PROVINCE" && user.managedProvinceId) {
    return {
      OR: [
        { scopeType: "PROVINCE", scopeId: user.managedProvinceId },
        { scopeType: "BRANCH" },
        { scopeType: "DOJO" },
      ],
    };
  }
  if (role === "ADMIN_BRANCH" && user.managedBranchId) {
    return {
      OR: [
        { scopeType: "BRANCH", scopeId: user.managedBranchId },
        { scopeType: "BRANCH", scopeId: "main" },
        { scopeType: "DOJO" },
      ],
    };
  }
  if (role === "ADMIN_DOJO") {
    const dojoIds = user.managedDojoIds?.length ? user.managedDojoIds : user.managedDojoId ? [user.managedDojoId] : [];
    return {
      scopeType: "DOJO",
      scopeId: { in: dojoIds },
    };
  }
  return { scopeId: "none" };
}

/**
 * Format Roman numerals for month
 */
export function getRomanMonth(monthIndex: number): string {
  const romans = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
  return romans[monthIndex] || "I";
}

/**
 * Format standard auto-numbering string based on category, scope, and sequence
 */
export function buildSuratNumberFormat(
  seq: number,
  kategori: string,
  scopeType: "PROVINCE" | "BRANCH" | "DOJO",
  dojoName?: string,
  date: Date = new Date()
): string {
  const padded = String(seq).padStart(3, "0");
  const monthRom = getRomanMonth(date.getMonth());
  const year = date.getFullYear();

  let katCode = "ST";
  if (kategori === "SK") katCode = "SK";
  else if (kategori === "UNDANGAN") katCode = "UND";
  else if (kategori === "KETERANGAN") katCode = "KET";
  else if (kategori === "PERMOHONAN") katCode = "PMH";
  else if (kategori === "PEMBERITAHUAN") katCode = "PBT";
  else if (kategori === "REKOMENDASI") katCode = "RKM";
  else if (kategori === "TUGAS") katCode = "ST";

  if (scopeType === "PROVINCE") {
    return `${padded}/INKAI-PENGPROV-JATIM/${katCode}/${monthRom}/${year}`;
  }
  if (scopeType === "DOJO" && dojoName) {
    const cleanDojo = dojoName.toUpperCase().replace(/[^A-Z0-9]/g, "-");
    return `${padded}/INKAI-DOJO-${cleanDojo}/${katCode}/${monthRom}/${year}`;
  }
  // Default Pengcab / Cabang Surabaya
  return `${padded}/INKAI-KOTA.SBY/${katCode}/${monthRom}/${year}`;
}
