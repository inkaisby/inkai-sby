import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/admin-session";
import {
  adminFallbackPath,
  canAccessAdminPath,
} from "@/lib/admin-page-access";
import { AdminPageLoader } from "@/components/ui/AdminPageLoader";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { KwitansiArsipTable } from "@/components/admin/kwitansi/KwitansiArsipTable";

export const dynamic = "force-dynamic";

export default function AdminKwitansiArsipPage() {
  return (
    <Suspense fallback={<AdminPageLoader rows={4} />}>
      <AdminKwitansiArsipContent />
    </Suspense>
  );
}

async function AdminKwitansiArsipContent() {
  const { user, adminDojoGrants } = await requireAdminSession();
  if (
    !canAccessAdminPath(
      user.roles ?? [],
      "/admin/kwitansi/arsip",
      adminDojoGrants,
    )
  ) {
    redirect(adminFallbackPath(user.roles ?? [], adminDojoGrants));
  }

  return (
    <>
      <AdminPageHeader
        title="Arsip Kwitansi"
        description="Riwayat & kelola arsip cetak kwitansi & nota pengeluaran."
      />
      <KwitansiArsipTable />
    </>
  );
}
