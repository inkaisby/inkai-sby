import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/admin-session";
import { canManageKebijakan } from "@/lib/pengaturan";
import {
  getBranchOrgProfile,
  getOperationalDefaults,
} from "@/lib/org-settings";
import { KebijakanManager } from "./KebijakanManager";

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
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Profil & Kebijakan</h2>
        <p className="text-muted-foreground">
          Sumber kebenaran kontak sekretariat, rekening, dan default operasional
          cabang.
        </p>
      </div>
      <KebijakanManager initialProfile={profile} initialDefaults={defaults} />
    </>
  );
}
