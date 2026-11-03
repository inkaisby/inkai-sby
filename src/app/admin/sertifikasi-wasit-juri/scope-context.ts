import type { AdminDojoGrants } from "@/lib/admin-dojo-grants";
import { getPrimaryAdminRole, type SessionUser } from "@/lib/rbac";
import { prisma, withPrismaFallback } from "@/lib/prisma";
import type { AddMemberDojoOption } from "@/components/admin/AddMemberDialog";
import {
  fetchWasitJuriData,
  resolveWasitJuriCrudPermission,
} from "@/lib/wasit-juri-data";

export async function resolveWasitJuriScopeContext(
  user: SessionUser,
  adminDojoGrants?: AdminDojoGrants | null,
) {
  const role = getPrimaryAdminRole(user.roles ?? []);
  const crudPermission = resolveWasitJuriCrudPermission(user, adminDojoGrants);
  const canManagePeriod = role !== "ADMIN_DOJO" && crudPermission.update;

  if (role === "ADMIN_DOJO" && user.managedDojoId) {
    const [{ data: dojo }, dbData] = await Promise.all([
      withPrismaFallback(
        "wasit-juri-dojo-scope",
        () =>
          prisma.dojo.findFirst({
            where: { id: user.managedDojoId!, isDeleted: false },
            select: { id: true, name: true },
          }),
        null,
      ),
      fetchWasitJuriData(user),
    ]);
    const dojoName = dojo?.name?.trim() || "Ranting Anda";
    const dojoList: AddMemberDojoOption[] = dojo
      ? [{ id: dojo.id, name: dojo.name.trim() }]
      : [];

    return {
      scopeLabel: `Ranting ${dojoName}`,
      lockedDojoId: dojo?.id ?? user.managedDojoId,
      lockedDojoName: dojo?.name?.trim() || null,
      canManagePeriod,
      crudPermission,
      dojoList,
      initialPeriods: dbData.periods,
      initialRegistrations: dbData.registrations,
    };
  }

  const branchWhere =
    role === "ADMIN_BRANCH" && user.managedBranchId
      ? { branchId: user.managedBranchId, isDeleted: false }
      : { isDeleted: false };

  const [{ data: branch }, { data: dojos }, dbData] = await Promise.all([
    role === "ADMIN_BRANCH" && user.managedBranchId
      ? withPrismaFallback(
          "wasit-juri-branch-scope",
          () =>
            prisma.branch.findFirst({
              where: { id: user.managedBranchId! },
              select: { name: true },
            }),
          null,
        )
      : Promise.resolve({ data: null }),
    withPrismaFallback(
      "wasit-juri-dojo-list",
      () =>
        prisma.dojo.findMany({
          where: branchWhere,
          select: { id: true, name: true },
          orderBy: { name: "asc" },
          take: 60,
        }),
      [],
    ),
    fetchWasitJuriData(user),
  ]);

  const dojoList: AddMemberDojoOption[] = dojos
    .map((d) => ({ id: d.id, name: d.name.trim() }))
    .filter((d) => Boolean(d.name));

  const scopeLabel =
    role === "ADMIN_BRANCH"
      ? branch?.name
        ? `Cabang ${branch.name}`
        : "Pengurus Cabang"
      : role === "ADMIN_PROVINCE"
        ? "Pengprov INKAI"
        : "Administrator Pusat";

  return {
    scopeLabel,
    lockedDojoId: null,
    lockedDojoName: null,
    canManagePeriod,
    crudPermission,
    dojoList,
    initialPeriods: dbData.periods,
    initialRegistrations: dbData.registrations,
  };
}
