import Link from "next/link";
import { requireAdminSession } from "@/lib/admin-session";
import { SETTINGS_HUB, SETTINGS_SHORTCUTS } from "@/lib/pengaturan";
import {
  canManageBranches,
  canManageGeofencing,
  canManageRanting,
  canManageRoles,
  canManageUsers,
  buildAdminUserWhere,
} from "@/lib/pengaturan";
import { fetchOrgStructure } from "@/lib/inkai-api/admin-data";
import { prisma } from "@/lib/prisma";
import { getPrimaryAdminRole } from "@/lib/rbac";
import { SettingsKpiGrid } from "@/components/admin/pengaturan/SettingsKpiGrid";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  ChevronRight,
  Home,
  KeyRound,
  MapPin,
  Settings,
  Shield,
  User,
  Users,
} from "lucide-react";
import { DojoPengaturanContent } from "./DojoPengaturanContent";

export const dynamic = "force-dynamic";

export default async function PengaturanHubPage() {
  const { user } = await requireAdminSession();
  const role = getPrimaryAdminRole(user.roles);

  if (role === "ADMIN_DOJO") {
    return <DojoPengaturanContent />;
  }

  return <PengaturanHubContent />;
}

async function PengaturanHubContent() {
  const { user, token } = await requireAdminSession();
  const role = getPrimaryAdminRole(user.roles);

  const access: Record<string, boolean> = {
    "/admin/pengaturan/user": canManageUsers(user),
    "/admin/pengaturan/cabang": canManageBranches(user),
    "/admin/pengaturan/ranting": canManageRanting(user),
    "/admin/pengaturan/peran": canManageRoles(user),
    "/admin/pengaturan/geofencing": canManageGeofencing(user),
    "/admin/pengaturan/akun": true,
  };

  const items = SETTINGS_HUB.filter((item) => access[item.href]);

  let userCount = 0;
  let branchCount = 0;
  let rantingCount = 0;
  let geofenceReady = 0;

  try {
    if (canManageUsers(user)) {
      userCount = await prisma.user.count({ where: buildAdminUserWhere(user) });
    }

    if (canManageBranches(user) || canManageRanting(user) || canManageGeofencing(user)) {
      const { branches, dojos } = await fetchOrgStructure(token);
      const lockedBranchId =
        role === "ADMIN_BRANCH" ? user.managedBranchId ?? null : null;

      const scopedBranches = lockedBranchId
        ? branches.filter((b) => String(b.id) === lockedBranchId)
        : branches;
      const scopedDojos = lockedBranchId
        ? dojos.filter((d) => {
            const branch = d.branch as { id?: string } | undefined;
            return String(branch?.id || "") === lockedBranchId;
          })
        : dojos;

      branchCount = scopedBranches.length;
      rantingCount = scopedDojos.length;

      if (canManageGeofencing(user) && scopedDojos.length > 0) {
        geofenceReady = await prisma.dojo.count({
          where: {
            id: { in: scopedDojos.map((d) => String(d.id)) },
            isDeleted: false,
            latitude: { not: null },
            longitude: { not: null },
          },
        });
      }
    }
  } catch {
    // KPI optional — page still usable
  }

  const moduleMeta: Record<
    string,
    { icon: typeof Users; value: string | number; columns: string }
  > = {
    "/admin/pengaturan/user": {
      icon: Users,
      value: userCount,
      columns: "Email, Nama, Role, Cakupan, Status",
    },
    "/admin/pengaturan/cabang": {
      icon: Building2,
      value: branchCount,
      columns: "Cabang, Provinsi, Ketua, Admin, Ranting",
    },
    "/admin/pengaturan/ranting": {
      icon: Home,
      value: rantingCount,
      columns: "Ranting, Cabang, PIC, Username Login",
    },
    "/admin/pengaturan/peran": {
      icon: Shield,
      value: "RBAC",
      columns: "Role, Permission, Jumlah User",
    },
    "/admin/pengaturan/geofencing": {
      icon: MapPin,
      value: `${geofenceReady}/${rantingCount || 0}`,
      columns: "Ranting, Lat, Long, Radius, Status",
    },
    "/admin/pengaturan/akun": {
      icon: User,
      value: "Profil",
      columns: "Nama, Telepon, Password",
    },
  };

  return (
    <>
      <div className="mb-6">
        <h2 className="flex items-center gap-2 text-2xl font-bold">
          <Settings className="h-6 w-6" />
          Pengaturan
        </h2>
        <p className="text-muted-foreground">
          Ringkasan konfigurasi user, organisasi, hak akses, dan absensi
        </p>
      </div>

      <SettingsKpiGrid
        items={[
          ...(canManageUsers(user)
            ? [{ label: "User Admin", value: userCount, icon: Users }]
            : []),
          ...(canManageBranches(user)
            ? [{ label: "Cabang", value: branchCount, icon: Building2 }]
            : []),
          ...(canManageRanting(user)
            ? [{ label: "Ranting", value: rantingCount, icon: Home }]
            : []),
          ...(canManageGeofencing(user)
            ? [
                {
                  label: "Geofence Siap",
                  value: geofenceReady,
                  hint: `dari ${rantingCount} ranting`,
                  icon: KeyRound,
                },
              ]
            : []),
        ]}
      />

      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Modul</TableHead>
              <TableHead className="hidden sm:table-cell">Deskripsi</TableHead>
              <TableHead className="hidden md:table-cell">Kolom Utama</TableHead>
              <TableHead>Jumlah / Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const meta = moduleMeta[item.href];
              const Icon = meta?.icon || Settings;
              return (
                <TableRow key={item.href}>
                  <TableCell>
                    <div className="flex items-center gap-2 font-medium">
                      <span className="rounded-lg bg-inkai-red/10 p-1.5 text-inkai-red">
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      {item.title}
                    </div>
                  </TableCell>
                  <TableCell className="hidden max-w-xs sm:table-cell text-sm text-muted-foreground">
                    {item.description}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                    {meta?.columns || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{meta?.value ?? "—"}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={item.href}
                      className="inline-flex items-center gap-1 text-sm font-medium text-inkai-red hover:underline"
                    >
                      Buka
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="mt-8">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Shortcut terkait
        </h3>
        <div className="grid gap-2 sm:grid-cols-3">
          {SETTINGS_SHORTCUTS.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="rounded-xl border p-3 transition-colors hover:border-inkai-red/40"
            >
              <p className="font-medium">{s.title}</p>
              <p className="text-sm text-muted-foreground">{s.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
