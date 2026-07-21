import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/admin-session";
import { canManageKebijakan } from "@/lib/pengaturan";
import { getUktRegistrationPolicy } from "@/lib/ukt-registration-policy";
import { UktPolicyManager } from "./UktPolicyManager";

export const dynamic = "force-dynamic";

export default async function PengaturanUktPage() {
  const { user } = await requireAdminSession();
  if (!canManageKebijakan(user)) redirect("/admin/pengaturan");

  const policy = await getUktRegistrationPolicy();

  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Pengaturan UKT</h2>
        <p className="text-muted-foreground">
          Centang persyaratan pendaftaran UKT tingkat cabang — tanpa ubah kode.
        </p>
      </div>
      <UktPolicyManager initialPolicy={policy} />
    </>
  );
}
