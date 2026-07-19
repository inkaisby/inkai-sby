import { requireAdminSession } from "@/lib/admin-session";
import { fetchOrgStructure } from "@/lib/inkai-api/admin-data";
import { getManagedDojoIdsFromUser } from "@/lib/managed-dojos";
import { prisma, withPrismaFallback } from "@/lib/prisma";
import { settingsUsernameLoadWarning, isPrismaBusyError } from "@/lib/prisma-errors";
import { ROLE_LABELS } from "@/lib/rbac";
import { RantingSettingsManager } from "@/app/admin/pengaturan/ranting/RantingSettingsManager";
import { AkunSayaForm } from "@/app/admin/pengaturan/akun/AkunSayaForm";
import { SettingsLoadWarning } from "@/components/admin/pengaturan/SettingsLoadWarning";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Home, KeyRound } from "lucide-react";

type RantingRow = {
  id: string;
  name: string;
  headName: string | null;
  address: string | null;
  phoneNumber: string | null;
  schedule: string | null;
  kecamatan: string | null;
  tempatLatihan: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankAccountName: string | null;
  branchId?: string;
  branchName?: string;
  memberCount: number;
  adminEmail: string | null;
  adminIsActive: boolean | null;
};

/** Satu halaman Pengaturan untuk admin ranting: data ranting + akun. */
export async function DojoPengaturanContent() {
  const { user, token } = await requireAdminSession();
  const allowlist = getManagedDojoIdsFromUser(user);
  const lockedDojoId = allowlist.length === 1 ? allowlist[0] : null;

  const { branches, dojos } = await fetchOrgStructure(token);

  let scopedBranches = branches.map((b) => ({
    id: String(b.id),
    name: String(b.name),
  }));
  let scopedDojos = dojos;

  if (allowlist.length > 0) {
    scopedDojos = dojos.filter((d) => allowlist.includes(String(d.id)));
    const branchIds = new Set(
      scopedDojos.map((d) => {
        const branch = d.branch as { id?: string } | undefined;
        return String(branch?.id || "");
      }),
    );
    scopedBranches = branches
      .filter((b) => branchIds.has(String(b.id)))
      .map((b) => ({ id: String(b.id), name: String(b.name) }));
  } else {
    scopedDojos = [];
  }

  const dojoIds = scopedDojos.map((d) => String(d.id));
  type AdminRow = {
    email: string;
    isActive: boolean;
    managedDojoId: string | null;
  };
  let admins: AdminRow[] = [];
  let adminLoadFailed = false;
  let adminLoadError: unknown;

  if (dojoIds.length) {
    const adminsResult = await withPrismaFallback(
      "dojo-pengaturan-admins",
      () =>
        prisma.user.findMany({
          where: {
            isDeleted: false,
            managedDojoId: { in: dojoIds },
            roles: { some: { name: "ADMIN_DOJO" } },
          },
          select: {
            email: true,
            isActive: true,
            managedDojoId: true,
          },
        }),
      [] as AdminRow[],
    );
    admins = adminsResult.data;
    adminLoadFailed = adminsResult.failed;
    adminLoadError = adminsResult.error;
  }

  const adminByDojo = new Map(
    admins
      .filter((a) => a.managedDojoId)
      .map((a) => [a.managedDojoId as string, a]),
  );

  const rantingRows: RantingRow[] = scopedDojos.map((d) => {
    const branch = d.branch as { id?: string; name?: string } | undefined;
    const id = String(d.id);
    const admin = adminByDojo.get(id);
    return {
      id,
      name: String(d.name),
      headName: (d.headName as string | null) ?? null,
      address: (d.address as string | null) ?? null,
      phoneNumber: (d.phoneNumber as string | null) ?? null,
      schedule: (d.schedule as string | null) ?? null,
      kecamatan: (d.kecamatan as string | null) ?? null,
      tempatLatihan: (d.tempatLatihan as string | null) ?? null,
      bankName: (d.bankName as string | null) ?? null,
      bankAccountNumber: (d.bankAccountNumber as string | null) ?? null,
      bankAccountName: (d.bankAccountName as string | null) ?? null,
      branchId: branch?.id ? String(branch.id) : undefined,
      branchName: branch?.name ? String(branch.name) : undefined,
      memberCount: (d._count as { members?: number } | undefined)?.members ?? 0,
      // Prefer email sesi (akun yang login) agar form Ubah Data menampilkan kredensial sendiri
      adminEmail: user.email || admin?.email || null,
      adminIsActive: admin?.isActive ?? null,
    };
  });

  const dbUserResult = await withPrismaFallback(
    "dojo-pengaturan-akun",
    () =>
      prisma.user.findUnique({
        where: { id: user.id },
        select: {
          email: true,
          fullName: true,
          phoneNumber: true,
          isActive: true,
          roles: { select: { name: true } },
          managedDojo: { select: { name: true } },
          managedBranch: { select: { name: true } },
          managedProvince: { select: { name: true } },
        },
      }),
    null,
  );

  const dbUser = dbUserResult.data;
  const roleLabels =
    dbUser?.roles.map((r) => ROLE_LABELS[r.name] || r.name) ?? [];
  const scopeLabel =
    dbUser?.managedDojo?.name ||
    dbUser?.managedBranch?.name ||
    dbUser?.managedProvince?.name ||
    "—";

  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-2xl font-bold">Pengaturan</h2>
        <p className="text-muted-foreground">
          Kelola data ranting Anda dan akun login di satu tempat
        </p>
      </div>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Home className="h-4 w-4 text-inkai-red" />
          <h3 className="text-lg font-semibold">Data Ranting</h3>
        </div>

        {!lockedDojoId ? (
          <Card>
            <CardContent className="space-y-3 p-6 text-sm text-muted-foreground">
              <p>
                Akun Anda belum terhubung ke ranting (
                <code className="text-foreground">managedDojoId</code> kosong).
              </p>
              <p>
                Minta admin cabang menautkan akun login Anda ke ranting yang
                benar di Pengaturan Ranting.
              </p>
            </CardContent>
          </Card>
        ) : rantingRows.length === 0 ? (
          <SettingsLoadWarning message="Data ranting belum berhasil dimuat. Coba refresh sebentar lagi." />
        ) : (
          <>
            {adminLoadFailed ? (
              <SettingsLoadWarning
                message={settingsUsernameLoadWarning("ranting", adminLoadError)}
              />
            ) : null}
            <RantingSettingsManager
              lockedBranchId={scopedBranches[0]?.id ?? null}
              selfManagedOnly
              adminsUnavailable={adminLoadFailed}
              branches={scopedBranches}
              dojos={rantingRows}
            />
          </>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-inkai-red" />
          <h3 className="text-lg font-semibold">Akun Saya</h3>
        </div>

        {dbUserResult.failed || !dbUser ? (
          <SettingsLoadWarning
            message={
              dbUserResult.error && isPrismaBusyError(dbUserResult.error)
                ? "Profil akun sementara tidak bisa dimuat (database sibuk). Coba lagi sebentar."
                : "Profil akun sementara tidak bisa dimuat. Coba lagi sebentar."
            }
          />
        ) : (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                Profil & password login
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AkunSayaForm
                initial={{
                  email: dbUser.email,
                  fullName: dbUser.fullName,
                  phoneNumber: dbUser.phoneNumber,
                  roleLabels,
                  scopeLabel,
                }}
              />
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
