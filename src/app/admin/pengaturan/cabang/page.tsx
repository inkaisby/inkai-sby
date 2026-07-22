import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/admin-session";
import { canManageBranches } from "@/lib/pengaturan";
import { fetchOrgStructure } from "@/lib/inkai-api/admin-data";
import { prisma, withPrismaFallback } from "@/lib/prisma";
import { settingsUsernameLoadWarning } from "@/lib/prisma-errors";
import { AdminPageLoader } from "@/components/ui/AdminPageLoader";
import { SettingsKpiGrid } from "@/components/admin/pengaturan/SettingsKpiGrid";
import {
  SettingsPagination,
  SettingsSearchForm,
  paginateSlice,
  parsePage,
  parsePageSize,
} from "@/components/admin/pengaturan/SettingsTableToolbar";
import { CabangSettingsManager } from "./CabangSettingsManager";
import { SettingsLoadWarning } from "@/components/admin/pengaturan/SettingsLoadWarning";
import { loadPrimaryEmailsByWilayah } from "@/lib/wilayah-accounts";
import { Building2, Home, MapPin, UserCheck } from "lucide-react";

export const dynamic = "force-dynamic";

const PAGE_SIZE_OPTIONS = [10, 50, 100];

type SearchParams = Promise<{
  q?: string;
  provinceId?: string;
  page?: string;
  pageSize?: string;
}>;

export default function PengaturanCabangPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <Suspense fallback={<AdminPageLoader rows={5} />}>
      <PengaturanCabangContent searchParams={searchParams} />
    </Suspense>
  );
}

async function PengaturanCabangContent({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { user, token } = await requireAdminSession();
  if (!canManageBranches(user)) redirect("/admin/pengaturan");

  const params = await searchParams;
  const q = params.q?.trim().toLowerCase() || "";
  const provinceId = params.provinceId?.trim() || "";
  const page = parsePage(params.page);
  const pageSize = parsePageSize(params.pageSize, PAGE_SIZE_OPTIONS, 10);

  const { provinces, branches } = await fetchOrgStructure(token);
  const orgLoadFailed = provinces.length === 0 && branches.length === 0;

  const branchIds = branches.map((b) => String(b.id));
  type AdminRow = {
    email: string;
    isActive: boolean;
    managedBranchId: string | null;
  };
  let admins: AdminRow[] = [];
  let adminLoadFailed = false;
  let adminLoadError: unknown;
  let archivedBranches: Array<{
    id: string;
    name: string;
    province: { name: string } | null;
  }> = [];

  if (branchIds.length) {
    const adminsResult = await withPrismaFallback(
      "pengaturan-cabang-admins",
      () =>
        prisma.user.findMany({
          where: {
            isDeleted: false,
            managedBranchId: { in: branchIds },
            roles: { some: { name: "ADMIN_BRANCH" } },
          },
          select: { email: true, isActive: true, managedBranchId: true },
          orderBy: [{ isActive: "desc" }, { email: "asc" }],
        }),
      [] as AdminRow[],
    );
    admins = adminsResult.data;
    adminLoadFailed = adminsResult.failed;
    adminLoadError = adminsResult.error;
  }

  const archivedResult = await withPrismaFallback(
    "pengaturan-cabang-archived",
    () =>
      prisma.branch.findMany({
        where: { isDeleted: true },
        select: {
          id: true,
          name: true,
          province: { select: { name: true } },
        },
        orderBy: { name: "asc" },
        take: 50,
      }),
    [] as Array<{
      id: string;
      name: string;
      province: { name: string } | null;
    }>,
  );
  archivedBranches = archivedResult.data;

  const warning = orgLoadFailed
    ? "Data organisasi belum berhasil dimuat (API sibuk/timeout). Tekan refresh sebentar lagi."
    : adminLoadFailed
      ? settingsUsernameLoadWarning("cabang", adminLoadError)
      : null;
  const adminsByBranch = new Map<
    string,
    Array<{ email: string; isActive: boolean }>
  >();
  for (const a of admins) {
    if (!a.managedBranchId) continue;
    const list = adminsByBranch.get(a.managedBranchId) ?? [];
    list.push({ email: a.email, isActive: a.isActive });
    adminsByBranch.set(a.managedBranchId, list);
  }

  const primaryResult = await withPrismaFallback(
    "pengaturan-cabang-primary",
    () =>
      loadPrimaryEmailsByWilayah({
        scope: "branch",
        wilayahIds: branchIds,
      }),
    new Map<string, string>(),
  );
  const primaryByBranch = primaryResult.data;

  const mapped = branches.map((b) => {
    const id = String(b.id);
    const branchAdmins = adminsByBranch.get(id) ?? [];
    const primaryEmail = primaryByBranch.get(id);
    const primary =
      (primaryEmail
        ? branchAdmins.find((a) => a.email === primaryEmail)
        : null) ??
      branchAdmins.find((a) => a.isActive) ??
      branchAdmins[0] ??
      null;
    return {
      id,
      name: String(b.name),
      headName: (b.headName as string | null) ?? null,
      city: (b.city as string | null) ?? null,
      provinceId: String(
        (b.province as { id?: string } | undefined)?.id || b.provinceId || "",
      ),
      provinceName: String(
        (b.province as { name?: string } | undefined)?.name || "",
      ),
      dojoCount: (b._count as { dojos?: number } | undefined)?.dojos ?? 0,
      adminEmail: primary?.email ?? null,
      adminCount: branchAdmins.length,
      adminIsPrimary: Boolean(primaryEmail && primary?.email === primaryEmail),
    };
  });

  const filtered = mapped.filter((b) => {
    if (provinceId && b.provinceId !== provinceId) return false;
    if (!q) return true;
    const adminEmails = (adminsByBranch.get(b.id) ?? [])
      .map((a) => a.email.toLowerCase())
      .join(" ");
    return (
      b.name.toLowerCase().includes(q) ||
      (b.headName || "").toLowerCase().includes(q) ||
      (b.city || "").toLowerCase().includes(q) ||
      (b.provinceName || "").toLowerCase().includes(q) ||
      adminEmails.includes(q)
    );
  });

  const withLogin = adminLoadFailed
    ? null
    : mapped.filter((b) => (b.adminCount ?? 0) > 0).length;
  const totalRanting = mapped.reduce((sum, b) => sum + (b.dojoCount || 0), 0);
  const provinceCount = new Set(mapped.map((b) => b.provinceId).filter(Boolean))
    .size;

  const { rows, total, totalPages, page: safePage } = paginateSlice(
    filtered,
    page,
    pageSize,
  );

  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Pengaturan Cabang</h2>
        <p className="text-muted-foreground">
          Tambah dan ubah cabang; satu cabang boleh punya beberapa akun admin, termasuk akun dual-role anggota + admin cabang
        </p>
      </div>

      {warning ? <SettingsLoadWarning message={warning} /> : null}

      <SettingsKpiGrid
        items={[
          { label: "Total Cabang", value: mapped.length, icon: Building2 },
          { label: "Provinsi", value: provinceCount, icon: MapPin },
          { label: "Total Ranting", value: totalRanting, icon: Home },
          {
            label: "Punya Akun Admin",
            value: withLogin === null ? "—" : withLogin,
            hint: withLogin === null ? "Data akun tidak tersedia" : undefined,
            icon: UserCheck,
          },
        ]}
      />

      <SettingsSearchForm
        q={q}
        qPlaceholder="Cari nama, ketua, kota, admin..."
        filterName="provinceId"
        filterValue={provinceId}
        filterLabel="Provinsi"
        filterOptions={[
          { value: "", label: "Semua provinsi" },
          ...provinces.map((p) => ({
            value: String(p.id),
            label: String(p.name),
          })),
        ]}
      />

      <CabangSettingsManager
        adminsUnavailable={adminLoadFailed}
        provinces={provinces.map((p) => ({
          id: String(p.id),
          name: String(p.name),
        }))}
        branches={rows}
        archived={archivedBranches.map((b) => ({
          id: b.id,
          name: b.name,
          provinceName: b.province?.name || "—",
          isDeleted: true,
        }))}
      />

      <SettingsPagination
        page={safePage}
        totalPages={totalPages}
        total={total}
        pageSize={pageSize}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
        baseParams={{ q, provinceId }}
      />
    </>
  );
}
