import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/admin-session";
import {
  buildScopedDojoWhere,
  canManageGeofencing,
} from "@/lib/pengaturan";
import { prisma } from "@/lib/prisma";
import { AdminPageLoader } from "@/components/ui/AdminPageLoader";
import { SettingsKpiGrid } from "@/components/admin/pengaturan/SettingsKpiGrid";
import {
  SettingsPagination,
  SettingsSearchForm,
  paginateSlice,
  parsePage,
} from "@/components/admin/pengaturan/SettingsTableToolbar";
import { GeofencingManager } from "./GeofencingManager";
import { MapPin, Navigation, CircleDot, Building2 } from "lucide-react";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

type SearchParams = Promise<{ q?: string; status?: string; page?: string }>;

export default function PengaturanGeofencingPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <Suspense fallback={<AdminPageLoader rows={5} />}>
      <PengaturanGeofencingContent searchParams={searchParams} />
    </Suspense>
  );
}

async function PengaturanGeofencingContent({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { user } = await requireAdminSession();
  if (!canManageGeofencing(user)) redirect("/admin/pengaturan");

  const params = await searchParams;
  const q = params.q?.trim().toLowerCase() || "";
  const status = params.status?.trim() || "";
  const page = parsePage(params.page);

  const dojos = await prisma.dojo.findMany({
    where: buildScopedDojoWhere(user),
    select: {
      id: true,
      name: true,
      latitude: true,
      longitude: true,
      geofenceRadius: true,
      branch: { select: { name: true } },
    },
    orderBy: { name: "asc" },
  });

  const mapped = dojos.map((d) => ({
    id: d.id,
    name: d.name,
    branchName: d.branch.name,
    latitude: d.latitude,
    longitude: d.longitude,
    geofenceRadius: d.geofenceRadius,
  }));

  const configured = mapped.filter(
    (d) => d.latitude != null && d.longitude != null,
  ).length;
  const avgRadius =
    mapped.length > 0
      ? Math.round(
          mapped.reduce((sum, d) => sum + (d.geofenceRadius || 0), 0) /
            mapped.length,
        )
      : 0;

  const filtered = mapped.filter((d) => {
    const hasCoord = d.latitude != null && d.longitude != null;
    if (status === "set" && !hasCoord) return false;
    if (status === "unset" && hasCoord) return false;
    if (!q) return true;
    return (
      d.name.toLowerCase().includes(q) ||
      d.branchName.toLowerCase().includes(q)
    );
  });

  const { rows, total, totalPages, page: safePage } = paginateSlice(
    filtered,
    page,
    PAGE_SIZE,
  );

  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Geofencing Absensi</h2>
        <p className="text-muted-foreground">
          Atur titik pusat dan radius maksimal absensi anggota per ranting
        </p>
      </div>

      <SettingsKpiGrid
        items={[
          { label: "Total Ranting", value: mapped.length, icon: Building2 },
          { label: "Sudah Diatur", value: configured, icon: MapPin },
          {
            label: "Belum Diatur",
            value: mapped.length - configured,
            icon: Navigation,
          },
          {
            label: "Rata-rata Radius",
            value: `${avgRadius} m`,
            icon: CircleDot,
          },
        ]}
      />

      <SettingsSearchForm
        q={q}
        qPlaceholder="Cari ranting atau cabang..."
        filterName="status"
        filterValue={status}
        filterLabel="Koordinat"
        filterOptions={[
          { value: "", label: "Semua" },
          { value: "set", label: "Sudah diatur" },
          { value: "unset", label: "Belum diatur" },
        ]}
      />

      <GeofencingManager dojos={rows} />

      <SettingsPagination
        page={safePage}
        totalPages={totalPages}
        total={total}
        pageSize={PAGE_SIZE}
        baseParams={{ q, status }}
      />
    </>
  );
}
