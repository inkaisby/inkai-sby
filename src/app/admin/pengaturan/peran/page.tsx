import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/admin-session";
import { canManageRoles } from "@/lib/pengaturan";
import { inkaiFetch } from "@/lib/inkai-api/server";
import { AdminPageLoader } from "@/components/ui/AdminPageLoader";
import { RolePermissionsManager } from "./RolePermissionsManager";
import { WilayahPermissionsMatrix } from "@/components/admin/WilayahPermissionsMatrix";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

export const dynamic = "force-dynamic";

export default function PengaturanPeranPage() {
  return (
    <Suspense fallback={<AdminPageLoader rows={4} />}>
      <PengaturanPeranContent />
    </Suspense>
  );
}

async function PengaturanPeranContent() {
  const { user, token } = await requireAdminSession();
  if (!canManageRoles(user)) redirect("/admin/pengaturan");

  const [rolesRes, permsRes] = await Promise.all([
    inkaiFetch("/v1/roles", {}, token),
    inkaiFetch("/v1/roles/permissions", {}, token),
  ]);

  const roles = rolesRes.res.ok
    ? ((rolesRes.data.data as Array<Record<string, unknown>>) ?? [])
    : [];
  const permissions = permsRes.res.ok
    ? ((permsRes.data.data as Array<Record<string, unknown>>) ?? [])
    : [];

  return (
    <>
      <AdminPageHeader
        title="Role & Hak Akses"
        description={
          <>
            Atur permission menu dan fitur per level pengurus
            {!rolesRes.res.ok ? (
              <>
                <br />
                <span className="text-destructive">
                  Gagal memuat data role dari API.
                </span>
              </>
            ) : null}
          </>
        }
      />

      <div className="mb-8">
        <WilayahPermissionsMatrix />
      </div>

      <RolePermissionsManager
        initialRoles={roles.map((r) => ({
          id: String(r.id),
          name: String(r.name),
          permissions:
            ((r.permissions as Array<{ permission: { id: string; name: string; slug: string } }>) ??
              []),
          _count: r._count as { users?: number } | undefined,
        }))}
        permissions={permissions.map((p) => ({
          id: String(p.id),
          name: String(p.name),
          slug: String(p.slug),
        }))}
      />
    </>
  );
}
