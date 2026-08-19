import { Suspense } from "react";
import { requireAdminSession } from "@/lib/admin-session";
import {
  adminFallbackPath,
  canAccessAdminPath,
} from "@/lib/admin-page-access";
import { getPrimaryAdminRole, type SessionUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { AdminPageLoader } from "@/components/ui/AdminPageLoader";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import {
  KwitansiWireframe,
  type KwitansiJenis,
} from "./KwitansiWireframe";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  jenis?: string;
  eventId?: string;
  event?: string;
}>;

export default function AdminKwitansiPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <Suspense fallback={<AdminPageLoader rows={4} />}>
      <AdminKwitansiContent searchParams={searchParams} />
    </Suspense>
  );
}

function parseJenis(raw?: string): KwitansiJenis | undefined {
  if (
    raw === "iuran" ||
    raw === "prestasi" ||
    raw === "pengeluaran" ||
    raw === "lainnya"
  ) {
    return raw;
  }
  if (raw === "hadiah") return "prestasi";
  return undefined;
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
    return branch?.name ? `Cabang ${branch.name}` : "Cabang";
  }
  return "Pusat";
}

async function AdminKwitansiContent({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { user, adminDojoGrants } = await requireAdminSession();
  if (
    !canAccessAdminPath(user.roles ?? [], "/admin/kwitansi", adminDojoGrants)
  ) {
    redirect(adminFallbackPath(user.roles ?? [], adminDojoGrants));
  }

  const sp = await searchParams;
  const initialJenis = parseJenis(sp.jenis);
  const initialEventLabel = (sp.event || "").trim();
  const scopeLabel = await resolveScopeLabel(user);

  return (
    <>
      <AdminPageHeader
        title="Kwitansi Pembayaran"
        description="Cetak kwitansi & nota pengeluaran."
      />
      <KwitansiWireframe
        scopeLabel={scopeLabel}
        initialJenis={initialJenis}
        initialEventLabel={initialEventLabel}
      />
    </>
  );
}
