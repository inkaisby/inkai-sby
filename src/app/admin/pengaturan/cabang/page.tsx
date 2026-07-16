import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/admin-session";
import { canManageBranches } from "@/lib/pengaturan";
import { fetchOrgStructure } from "@/lib/inkai-api/admin-data";
import { prisma } from "@/lib/prisma";
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
import { Building2, Home, MapPin, UserCheck } from "lucide-react";

export const dynamic = "force-dynamic";

const PAGE_SIZE_OPTIONS = [10, 50, 100, 1000];

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

  const branchIds = branches.map((b) => String(b.id));
  const admins = branchIds.length
    ? await prisma.user.findMany({
        where: {
          isDeleted: false,
          managedBranchId: { in: branchIds },
          roles: { some: { name: "ADMIN_BRANCH" } },
        },
        select: { email: true, managedBranchId: true },
      })
    : [];
  const adminByBranch = new Map(
    admins
      .filter((a) => a.managedBranchId)
      .map((a) => [a.managedBranchId as string, a.email]),
  );

  const mapped = branches.map((b) => {
    const id = String(b.id);
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
      adminEmail: adminByBranch.get(id) ?? null,
    };
  });

  const filtered = mapped.filter((b) => {
    if (provinceId && b.provinceId !== provinceId) return false;
    if (!q) return true;
    return (
      b.name.toLowerCase().includes(q) ||
      (b.headName || "").toLowerCase().includes(q) ||
      (b.city || "").toLowerCase().includes(q) ||
      (b.provinceName || "").toLowerCase().includes(q) ||
      (b.adminEmail || "").toLowerCase().includes(q)
    );
  });

  const withLogin = mapped.filter((b) => b.adminEmail).length;
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
          Tambah dan ubah cabang beserta akun admin cabang
        </p>
      </div>

      <SettingsKpiGrid
        items={[
          { label: "Total Cabang", value: mapped.length, icon: Building2 },
          { label: "Provinsi", value: provinceCount, icon: MapPin },
          { label: "Total Ranting", value: totalRanting, icon: Home },
          { label: "Punya Admin Login", value: withLogin, icon: UserCheck },
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
        provinces={provinces.map((p) => ({
          id: String(p.id),
          name: String(p.name),
        }))}
        branches={rows}
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
