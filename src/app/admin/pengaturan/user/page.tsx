import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/admin-session";
import { canManageUsers, buildAdminUserWhere } from "@/lib/pengaturan";
import { prisma, withPrismaFallback } from "@/lib/prisma";
import { ROLE_LABELS } from "@/lib/rbac";
import { AdminPageLoader } from "@/components/ui/AdminPageLoader";
import { SettingsKpiGrid } from "@/components/admin/pengaturan/SettingsKpiGrid";
import { SettingsLoadWarning } from "@/components/admin/pengaturan/SettingsLoadWarning";
import {
  SettingsPagination,
  SettingsSearchForm,
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
  const { user } = await requireAdminSession();
  if (!canManageUsers(user)) redirect("/admin/pengaturan");

  const params = await searchParams;
  const q = params.q?.trim() || "";
  const status = params.status?.trim() || "";
  const page = parsePage(params.page);
  const pageSize = parsePageSize(params.pageSize, PAGE_SIZE_OPTIONS, 10);

  const baseWhere = buildAdminUserWhere(user);

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
            ],
          },
          select: {
            id: true,
            email: true,
            fullName: true,
            phoneNumber: true,
            isActive: true,
            createdAt: true,
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

  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Pengaturan User</h2>
        <p className="text-muted-foreground">
          Kelola akun admin. Akun baru dibuat saat menambah cabang/ranting.
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

      <SettingsSearchForm
        q={q}
        qPlaceholder="Cari email, nama, atau telepon..."
        filterName="status"
        filterValue={status}
        filterLabel="Status"
        filterOptions={[
          { value: "", label: "Semua status" },
          { value: "active", label: "Aktif" },
          { value: "inactive", label: "Nonaktif" },
        ]}
      />

      <UserSettingsTable users={rows} />

      <SettingsPagination
        page={safePage}
        totalPages={totalPages}
        total={total}
        pageSize={pageSize}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
        baseParams={{ q, status }}
      />
    </>
  );
}
