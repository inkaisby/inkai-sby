import { requireAdminSession } from "@/lib/admin-session";
import {
  getManagedDojoIdsFromUser,
  loadManagedDojoIds,
} from "@/lib/managed-dojos";
import { prisma, withPrismaFallback } from "@/lib/prisma";
import { settingsUsernameLoadWarning, isPrismaBusyError } from "@/lib/prisma-errors";
import { ROLE_LABELS } from "@/lib/rbac";
import { RantingSettingsManager } from "@/app/admin/pengaturan/ranting/RantingSettingsManager";
import { AkunSayaForm } from "@/app/admin/pengaturan/akun/AkunSayaForm";
import { SettingsLoadWarning } from "@/components/admin/pengaturan/SettingsLoadWarning";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
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
  const { user } = await requireAdminSession();

  // Session + AppSetting; fallback DB jika JWT belum punya managedDojoId
  let allowlist = getManagedDojoIdsFromUser(user);

  if (allowlist.length === 0) {
    const dbIds = await withPrismaFallback(
      "dojo-pengaturan-allowlist",
      async () => {
        const row = await prisma.user.findUnique({
          where: { id: user.id },
          select: { managedDojoId: true },
        });
        return loadManagedDojoIds(user.id, row?.managedDojoId ?? null);
      },
      [] as string[],
    );
    allowlist = dbIds.data;
  }

  type AdminRow = {
    email: string;
    isActive: boolean;
    managedDojoId: string | null;
  };

  const [dojosResult, adminsResult, dbUserResult] = await Promise.all([
    allowlist.length === 0
      ? Promise.resolve({
          data: [] as Array<{
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
            branchId: string;
            branch: { id: string; name: string } | null;
            _count: { members: number };
          }>,
          failed: false,
          error: undefined as unknown,
        })
      : withPrismaFallback(
          "dojo-pengaturan-dojos",
          () =>
            prisma.dojo.findMany({
              where: { id: { in: allowlist }, isDeleted: false },
              select: {
                id: true,
                name: true,
                headName: true,
                address: true,
                phoneNumber: true,
                schedule: true,
                kecamatan: true,
                tempatLatihan: true,
                bankName: true,
                bankAccountNumber: true,
                bankAccountName: true,
                branchId: true,
                branch: { select: { id: true, name: true } },
                _count: { select: { members: true } },
              },
              orderBy: { name: "asc" },
            }),
          [],
        ),
    allowlist.length === 0
      ? Promise.resolve({
          data: [] as AdminRow[],
          failed: false,
          error: undefined as unknown,
        })
      : withPrismaFallback(
          "dojo-pengaturan-admins",
          () =>
            prisma.user.findMany({
              where: {
                isDeleted: false,
                managedDojoId: { in: allowlist },
                roles: { some: { name: "ADMIN_DOJO" } },
              },
              select: {
                email: true,
                isActive: true,
                managedDojoId: true,
              },
            }),
          [] as AdminRow[],
        ),
    withPrismaFallback(
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
    ),
  ]);

  const adminLoadFailed = adminsResult.failed;
  const adminByDojo = new Map(
    (adminsResult.data ?? [])
      .filter((a) => a.managedDojoId)
      .map((a) => [a.managedDojoId as string, a]),
  );

  const rantingRows: RantingRow[] = (dojosResult.data ?? []).map((d) => {
    const admin = adminByDojo.get(d.id);
    return {
      id: d.id,
      name: d.name,
      headName: d.headName,
      address: d.address,
      phoneNumber: d.phoneNumber,
      schedule: d.schedule,
      kecamatan: d.kecamatan,
      tempatLatihan: d.tempatLatihan,
      bankName: d.bankName,
      bankAccountNumber: d.bankAccountNumber,
      bankAccountName: d.bankAccountName,
      branchId: d.branch?.id ?? d.branchId,
      branchName: d.branch?.name,
      memberCount: d._count.members,
      adminEmail: admin?.email ?? null,
      adminIsActive: admin?.isActive ?? null,
    };
  });

  const scopedBranches = Array.from(
    new Map(
      rantingRows
        .filter((r) => r.branchId)
        .map((r) => [
          r.branchId as string,
          { id: r.branchId as string, name: r.branchName || "Cabang" },
        ]),
    ).values(),
  );

  const dbUser = dbUserResult.data;
  const roleLabels =
    dbUser?.roles.map((r) => ROLE_LABELS[r.name] || r.name) ?? [];
  const scopeLabel =
    dbUser?.managedDojo?.name ||
    (rantingRows.length > 1
      ? `${rantingRows.length} ranting`
      : rantingRows[0]?.name) ||
    dbUser?.managedBranch?.name ||
    dbUser?.managedProvince?.name ||
    "—";

  return (
    <div className="space-y-10">
      <AdminPageHeader
        title="Pengaturan"
        description="Kelola data ranting Anda dan akun login di satu tempat"
      />

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Home className="h-4 w-4 text-inkai-red" />
          <h3 className="text-lg font-semibold">Data Ranting</h3>
        </div>

        {allowlist.length === 0 ? (
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
        ) : dojosResult.failed ? (
          <SettingsLoadWarning
            message={
              isPrismaBusyError(dojosResult.error)
                ? "Data ranting sementara tidak bisa dimuat (database sibuk). Coba lagi sebentar."
                : "Data ranting belum berhasil dimuat. Coba refresh sebentar lagi."
            }
          />
        ) : rantingRows.length === 0 ? (
          <SettingsLoadWarning message="Ranting terhubung tidak ditemukan atau sudah diarsipkan. Hubungi admin cabang." />
        ) : (
          <>
            {adminLoadFailed ? (
              <SettingsLoadWarning
                message={settingsUsernameLoadWarning(
                  "ranting",
                  adminsResult.error,
                )}
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
