import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/admin-session";
import {
  adminFallbackPath,
  canAccessAdminPath,
} from "@/lib/admin-page-access";
import { getPrimaryAdminRole, type SessionUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { AdminPageLoader } from "@/components/ui/AdminPageLoader";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { KasLedgerClient } from "@/components/admin/kas/KasLedgerClient";

export const dynamic = "force-dynamic";

export default function AdminKasPage() {
  return (
    <Suspense fallback={<AdminPageLoader rows={6} />}>
      <AdminKasContent />
    </Suspense>
  );
}

async function resolveScopeLabel(user: SessionUser): Promise<string> {
  const role = getPrimaryAdminRole(user.roles ?? []);
  if (role === "ADMIN_DOJO" && user.managedDojoId) {
    const dojo = await prisma.dojo.findFirst({
      where: { id: user.managedDojoId },
      select: { name: true },
    });
    return dojo?.name ? `Ranting ${dojo.name}` : "Ranting";
  }
  if (role === "ADMIN_BRANCH" && user.managedBranchId) {
    const branch = await prisma.branch.findFirst({
      where: { id: user.managedBranchId },
      select: { name: true },
    });
    return branch?.name ? `Cabang ${branch.name}` : "Cabang Surabaya";
  }
  return "Cabang Surabaya";
}

async function AdminKasContent() {
  const { user, adminDojoGrants } = await requireAdminSession();
  if (!canAccessAdminPath(user.roles ?? [], "/admin/kas", adminDojoGrants)) {
    redirect(adminFallbackPath(user.roles ?? [], adminDojoGrants));
  }
  const scopeLabel = await resolveScopeLabel(user);
  return (
    <div>
      <AdminPageHeader
        title="Kas"
        description={`${scopeLabel}. Buku kas otomatis dari iuran/UKT/Latber yang sudah diverifikasi, plus Tambah manual.`}
      />
      <KasLedgerClient scopeLabel={scopeLabel} />
    </div>
  );
}
