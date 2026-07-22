import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/admin-session";
import { canManageKebijakan } from "@/lib/pengaturan";
import {
  getBranchOrgProfile,
  getOperationalDefaults,
} from "@/lib/org-settings";
import { KebijakanManager } from "./KebijakanManager";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

export const dynamic = "force-dynamic";

export default async function KebijakanPage() {
  const { user } = await requireAdminSession();
  if (!canManageKebijakan(user)) redirect("/admin/pengaturan");

  const [profile, defaults] = await Promise.all([
    getBranchOrgProfile(),
    getOperationalDefaults(),
  ]);

  return (
    <>
      <AdminPageHeader
        title="Profil & Kebijakan"
        description="Sumber kebenaran kontak sekretariat, rekening, dan default operasional cabang."
      />
      <KebijakanManager initialProfile={profile} initialDefaults={defaults} />
    </>
  );
}
