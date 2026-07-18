import Link from "next/link";
import { requireAdminSession } from "@/lib/admin-session";
import {
  SETTINGS_GROUP_LABELS,
  SETTINGS_HUB,
  SETTINGS_SHORTCUTS,
  canManageBranches,
  canManageGeofencing,
  canManageKebijakan,
  canManageRanting,
  canManageRoles,
  canManageUsers,
  buildAdminUserWhere,
} from "@/lib/pengaturan";
import { fetchOrgStructure } from "@/lib/inkai-api/admin-data";
import { prisma } from "@/lib/prisma";
import { getPrimaryAdminRole } from "@/lib/rbac";
import { buildCabangSetupChecklist } from "@/lib/org-settings";
import { SettingsKpiGrid } from "@/components/admin/pengaturan/SettingsKpiGrid";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  ChevronRight,
  ClipboardCheck,
  Home,
  MapPin,
  Scale,
  Settings,
  Shield,
  User,
  Users,
} from "lucide-react";
import { DojoPengaturanContent } from "./DojoPengaturanContent";
import { WilayahPermissionsMatrix } from "@/components/admin/WilayahPermissionsMatrix";

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
    "/admin/pengaturan/kebijakan": canManageKebijakan(user),
    "/admin/pengaturan/peran": canManageRoles(user),
    "/admin/pengaturan/geofencing": canManageGeofencing(user),
    "/admin/pengaturan/akun": true,
  };

  const items = SETTINGS_HUB.filter((item) => access[item.href]);

  let userCount = 0;
  let branchCount = 0;
  let rantingCount = 0;
  let geofenceReady = 0;
  let adminBranchCount = 0;
  let lockedBranchId: string | null = null;

  try {
    if (canManageUsers(user)) {
      userCount = await prisma.user.count({ where: buildAdminUserWhere(user) });
    }

    if (canManageBranches(user) || canManageRanting(user) || canManageGeofencing(user)) {
      const { branches, dojos } = await fetchOrgStructure(token);
      lockedBranchId =
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

      if (lockedBranchId) {
        adminBranchCount = await prisma.user.count({
          where: {
            isDeleted: false,
            isActive: true,
            managedBranchId: lockedBranchId,
            roles: { some: { name: "ADMIN_BRANCH" } },
          },
        });
      } else if (canManageUsers(user)) {
        adminBranchCount = await prisma.user.count({
          where: {
            isDeleted: false,
            isActive: true,
            roles: { some: { name: "ADMIN_BRANCH" } },
          },
        });
      }
    }
  } catch {
    // KPI optional
  }

  const checklist = canManageKebijakan(user)
    ? await buildCabangSetupChecklist({
        branchId: lockedBranchId,
        dojoIds: [],
        adminCount: adminBranchCount,
        geofenceReady,
        rantingCount,
      })
    : null;

  const moduleMeta: Record<
    string,
    { icon: typeof Users; value: string | number }
  > = {
    "/admin/pengaturan/user": { icon: Users, value: userCount },
    "/admin/pengaturan/cabang": { icon: Building2, value: branchCount },
    "/admin/pengaturan/ranting": { icon: Home, value: rantingCount },
    "/admin/pengaturan/kebijakan": { icon: Scale, value: "Profil" },
    "/admin/pengaturan/peran": { icon: Shield, value: "RBAC" },
    "/admin/pengaturan/geofencing": {
      icon: MapPin,
      value: `${geofenceReady}/${rantingCount || 0}`,
    },
    "/admin/pengaturan/akun": { icon: User, value: "Profil" },
  };

  const groups = ["akun", "wilayah", "kebijakan", "operasional"] as const;

  return (
    <>
      <div className="mb-6">
        <h2 className="flex items-center gap-2 text-2xl font-bold">
          <Settings className="h-6 w-6" />
          Pengaturan
        </h2>
        <p className="text-muted-foreground">
          Pusat kendali akun, wilayah, kebijakan, dan absensi
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
                  icon: MapPin,
                },
              ]
            : []),
        ]}
      />

      {checklist ? (
        <div className="mb-8 rounded-xl border p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-inkai-red" />
              <h3 className="font-semibold">Checklist setup cabang</h3>
            </div>
            <Badge variant="secondary">
              {checklist.done}/{checklist.total} siap
            </Badge>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {checklist.items.map((item) => (
              <li key={item.id}>
                {item.href ? (
                  <Link
                    href={item.href}
                    className="flex items-start gap-2 rounded-lg border px-3 py-2 text-sm transition-colors hover:border-inkai-red/40"
                  >
                    <span
                      className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                        item.done ? "bg-emerald-500" : "bg-amber-400"
                      }`}
                    />
                    <span className={item.done ? "text-muted-foreground" : ""}>
                      {item.label}
                    </span>
                  </Link>
                ) : (
                  <span className="flex items-start gap-2 px-3 py-2 text-sm">
                    <span
                      className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                        item.done ? "bg-emerald-500" : "bg-amber-400"
                      }`}
                    />
                    {item.label}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mb-8 space-y-6">
        {groups.map((group) => {
          const groupItems = items.filter((i) => i.group === group);
          if (groupItems.length === 0) return null;
          return (
            <section key={group}>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {SETTINGS_GROUP_LABELS[group]}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {groupItems.map((item) => {
                  const meta = moduleMeta[item.href];
                  const Icon = meta?.icon || Settings;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="group rounded-xl border p-4 transition-colors hover:border-inkai-red/40"
                    >
                      <div className="mb-3 flex items-start justify-between gap-2">
                        <span className="rounded-lg bg-inkai-red/10 p-2 text-inkai-red">
                          <Icon className="h-4 w-4" />
                        </span>
                        <Badge variant="secondary">{meta?.value ?? "—"}</Badge>
                      </div>
                      <p className="font-semibold group-hover:text-inkai-red">
                        {item.title}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {item.description}
                      </p>
                      <p className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-inkai-red">
                        Buka
                        <ChevronRight className="h-3.5 w-3.5" />
                      </p>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <div className="mb-8">
        <WilayahPermissionsMatrix />
      </div>

      <div className="mt-8 space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Terkait
        </h3>
        <div className="grid gap-2 sm:grid-cols-3">
          {SETTINGS_SHORTCUTS.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="rounded-xl border p-3 transition-colors hover:border-inkai-red/40"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {s.kind === "kebijakan"
                  ? "Kebijakan"
                  : s.kind === "konten"
                    ? "Konten"
                    : "Audit"}
              </p>
              <p className="font-medium">{s.title}</p>
              <p className="text-sm text-muted-foreground">{s.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
