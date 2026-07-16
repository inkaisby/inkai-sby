import { Suspense } from "react";
import { requireAdminSession } from "@/lib/admin-session";
import { prisma, withPrismaFallback } from "@/lib/prisma";
import { ROLE_LABELS } from "@/lib/rbac";
import { AdminPageLoader } from "@/components/ui/AdminPageLoader";
import { SettingsKpiGrid } from "@/components/admin/pengaturan/SettingsKpiGrid";
import { SettingsLoadWarning } from "@/components/admin/pengaturan/SettingsLoadWarning";
import { AkunSayaForm } from "./AkunSayaForm";
import { KeyRound, Shield, User } from "lucide-react";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function PengaturanAkunPage() {
  return (
    <Suspense fallback={<AdminPageLoader rows={4} />}>
      <PengaturanAkunContent />
    </Suspense>
  );
}

async function PengaturanAkunContent() {
  const { user } = await requireAdminSession();

  const dbUserResult = await withPrismaFallback(
    "pengaturan-akun",
    () =>
      prisma.user.findUnique({
        where: { id: user.id },
        select: {
          email: true,
          fullName: true,
          phoneNumber: true,
          isActive: true,
          roles: { select: { name: true } },
          managedProvince: { select: { name: true } },
          managedBranch: { select: { name: true } },
          managedDojo: { select: { name: true } },
        },
      }),
    null,
  );

  const dbUser = dbUserResult.data;

  if (dbUserResult.failed) {
    return (
      <>
        <div className="mb-6">
          <h2 className="text-2xl font-bold">Akun Saya</h2>
          <p className="text-muted-foreground">Profil akun admin yang sedang login</p>
        </div>
        <SettingsLoadWarning message="Profil akun sementara tidak bisa dimuat (database sibuk). Coba lagi sebentar." />
      </>
    );
  }

  if (!dbUser) redirect("/admin/pengaturan");

  const roleLabels = dbUser.roles.map((r) => ROLE_LABELS[r.name] || r.name);
  const scopeLabel =
    dbUser.managedDojo?.name ||
    dbUser.managedBranch?.name ||
    dbUser.managedProvince?.name ||
    "—";

  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Akun Saya</h2>
        <p className="text-muted-foreground">
          Kelola profil dan password akun admin yang sedang login
        </p>
      </div>

      <SettingsKpiGrid
        items={[
          { label: "Email", value: dbUser.email.split("@")[0] || "—", icon: User },
          {
            label: "Role",
            value: roleLabels[0] || "—",
            icon: Shield,
          },
          {
            label: "Status",
            value: dbUser.isActive ? "Aktif" : "Nonaktif",
            icon: KeyRound,
          },
        ]}
      />

      <AkunSayaForm
        initial={{
          email: dbUser.email,
          fullName: dbUser.fullName,
          phoneNumber: dbUser.phoneNumber,
          roleLabels,
          scopeLabel,
        }}
      />
    </>
  );
}
