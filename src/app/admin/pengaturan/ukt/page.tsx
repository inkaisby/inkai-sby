import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/admin-session";
import { canManageKebijakan } from "@/lib/pengaturan";
import { getUktRegistrationPolicy } from "@/lib/ukt-registration-policy";
import { UktPolicyManager } from "./UktPolicyManager";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminPageLoader } from "@/components/ui/AdminPageLoader";

export const dynamic = "force-dynamic";

export default function PengaturanUktPage() {
  return (
    <Suspense fallback={<AdminPageLoader rows={4} />}>
      <PengaturanUktContent />
    </Suspense>
  );
}

async function PengaturanUktContent() {
  const { user } = await requireAdminSession();
  if (!canManageKebijakan(user)) redirect("/admin/pengaturan");

  const policy = await getUktRegistrationPolicy();

  return (
    <>
      <AdminPageHeader
        title="Pengaturan UKT"
        description="Centang persyaratan pendaftaran UKT tingkat cabang — tanpa ubah kode."
      />
      <UktPolicyManager initialPolicy={policy} />
    </>
  );
}
