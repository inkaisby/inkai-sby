import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/admin-session";
import { canManageKebijakan } from "@/lib/pengaturan";
import { getUktRegistrationPolicy } from "@/lib/ukt-registration-policy";
import { UktPolicyManager } from "./UktPolicyManager";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

export const dynamic = "force-dynamic";

export default async function PengaturanUktPage() {
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
