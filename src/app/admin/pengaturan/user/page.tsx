import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/admin-session";
import { canManageUsers, buildAdminUserWhere } from "@/lib/pengaturan";
import { fetchOrgStructure } from "@/lib/inkai-api/admin-data";
import { prisma, withPrismaFallback } from "@/lib/prisma";
import { getPrimaryAdminRole, ROLE_LABELS } from "@/lib/rbac";
import { AdminPageLoader } from "@/components/ui/AdminPageLoader";
import { SettingsKpiGrid } from "@/components/admin/pengaturan/SettingsKpiGrid";
import { SettingsLoadWarning } from "@/components/admin/pengaturan/SettingsLoadWarning";
import {
  SettingsPagination,
  paginateSlice,
  parsePage,
  parsePageSize,
} from "@/components/admin/pengaturan/SettingsTableToolbar";
import { UserSettingsTable } from "./UserSettingsTable";
import { ShieldCheck, UserCheck, UserX, Users } from "lucide-react";

export const dynamic = "force-dynamic";

const PAGE_SIZE_OPTIONS = [10, 50, 100, 1000];

type SearchParams = Promise<{
  q?: string;
  status?: string;
  role?: string;
  page?: string;
  pageSize?: string;
}>;

export default function PengaturanUserPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <Suspense fallback={<AdminPageLoader rows={6} />}>
      <PengaturanUserContent searchParams={searchParams} />
    </Suspense>
  );
}

async function PengaturanUserContent({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { user, token } = await requireAdminSession();
  if (!canManageUsers(user)) redirect("/admin/pengaturan");

  const params = await searchParams;
  const q = params.q?.trim() || "";
  const status = params.status?.trim() || "";
  const roleFilter = params.role?.trim() || "";
  const page = parsePage(params.page);
  const pageSize = parsePageSize(params.pageSize, PAGE_SIZE_OPTIONS, 10);

  const baseWhere = buildAdminUserWhere(user);
  const { provinces, branches, dojos } = await fetchOrgStructure(token);

  const lockedBranchId =
    getPrimaryAdminRole(user.roles) === "ADMIN_BRANCH"
      ? user.managedBranchId ?? null
      : null;

  const usersResult = await withPrismaFallback(
    "pengaturan-user-list",
    () =>
      Promise.all([
        prisma.user.findMany({
          where: {
            AND: [
              baseWhere,
              q
                ? {
                    OR: [
                      { email: { contains: q, mode: "insensitive" } },
                      { fullName: { contains: q, mode: "insensitive" } },
                      { phoneNumber: { contains: q, mode: "insensitive" } },
                    ],
                  }
                : {},
              status === "active"
                ? { isActive: true }
                : status === "inactive"
                  ? { isActive: false }
                  : {},
              roleFilter ? { roles: { some: { name: roleFilter } } } : {},
            ],
          },
          select: {
            id: true,
            email: true,
            fullName: true,
            phoneNumber: true,
            isActive: true,
            createdAt: true,
            managedProvinceId: true,
            managedBranchId: true,
            managedDojoId: true,
            roles: { select: { name: true } },
            managedProvince: { select: { name: true } },
            managedBranch: { select: { name: true } },
            managedDojo: { select: { name: true } },
          },
          orderBy: { email: "asc" },
        }),
        prisma.user.count({ where: { AND: [baseWhere, { isActive: true }] } }),
        prisma.user.count({ where: { AND: [baseWhere, { isActive: false }] } }),
      ]),
    [[], 0, 0] as const,
  );

  const [allUsers, activeCount, inactiveCount] = usersResult.data;

  const roleSet = new Set(allUsers.flatMap((u) => u.roles.map((r) => r.name)));
  const mapped = allUsers.map((u) => ({
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    phoneNumber: u.phoneNumber,
    isActive: u.isActive,
    roleLabels: u.roles.map((r) => ROLE_LABELS[r.name] || r.name),
    primaryRole: u.roles[0]?.name ?? null,
    managedProvinceId: u.managedProvinceId,
    managedBranchId: u.managedBranchId,
    managedDojoId: u.managedDojoId,
    scopeLabel:
      u.managedDojo?.name ||
      u.managedBranch?.name ||
      u.managedProvince?.name ||
      "—",
    createdAt: u.createdAt.toISOString(),
  }));

  const { rows, total, totalPages, page: safePage } = paginateSlice(
    mapped,
    page,
    pageSize,
  );

  const scopedBranches = lockedBranchId
    ? branches.filter((b) => String(b.id) === lockedBranchId)
    : branches;
  const scopedDojos = lockedBranchId
    ? dojos.filter((d) => {
        const branch = d.branch as { id?: string } | undefined;
        return String(branch?.id || "") === lockedBranchId;
      })
    : dojos;

  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Pengaturan User</h2>
        <p className="text-muted-foreground">
          Buat, ubah role/cakupan, reset password, aktifkan/nonaktifkan admin.
        </p>
      </div>

      {usersResult.failed ? (
        <SettingsLoadWarning message="Data user sementara tidak tersedia (database sibuk). Coba refresh sebentar lagi." />
      ) : null}

      <SettingsKpiGrid
        items={[
          {
            label: "Total User",
            value: activeCount + inactiveCount,
            icon: Users,
          },
          { label: "Aktif", value: activeCount, icon: UserCheck },
          { label: "Nonaktif", value: inactiveCount, icon: UserX },
          {
            label: "Jenis Role",
            value: roleSet.size,
            hint: "Dalam hasil filter",
            icon: ShieldCheck,
          },
        ]}
      />

      <form className="mb-4 flex flex-wrap items-end gap-2">
        <div className="min-w-[180px] flex-1 space-y-1">
          <label className="text-xs text-muted-foreground">Pencarian</label>
          <input
            name="q"
            defaultValue={q}
            placeholder="Cari email, nama, atau telepon..."
            className="flex h-8 w-full rounded-lg border px-3 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Status</label>
          <select
            name="status"
            defaultValue={status}
            className="h-8 min-w-[140px] rounded-lg border px-2 text-sm"
          >
            <option value="">Semua status</option>
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Role</label>
          <select
            name="role"
            defaultValue={roleFilter}
            className="h-8 min-w-[140px] rounded-lg border px-2 text-sm"
          >
            <option value="">Semua role</option>
            <option value="ADMIN_DOJO">Admin Ranting</option>
            <option value="ADMIN_BRANCH">Admin Cabang</option>
            <option value="ADMIN_PROVINCE">Admin Provinsi</option>
            <option value="ADMINISTRATOR">Administrator</option>
          </select>
        </div>
        <button
          type="submit"
          className="h-8 rounded-lg bg-inkai-red px-4 text-sm text-white"
        >
          Filter
        </button>
      </form>

      <UserSettingsTable
        users={rows}
        branches={scopedBranches.map((b) => ({
          id: String(b.id),
          name: String(b.name),
        }))}
        dojos={scopedDojos.map((d) => {
          const branch = d.branch as { id?: string } | undefined;
          return {
            id: String(d.id),
            name: String(d.name),
            branchId: branch?.id ? String(branch.id) : undefined,
          };
        })}
        provinces={provinces.map((p) => ({
          id: String(p.id),
          name: String(p.name),
        }))}
      />

      <SettingsPagination
        page={safePage}
        totalPages={totalPages}
        total={total}
        pageSize={pageSize}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
        baseParams={{ q, status, role: roleFilter }}
      />
    </>
  );
}
