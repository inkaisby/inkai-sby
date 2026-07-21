import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/admin-session";
import { canManageRanting } from "@/lib/pengaturan";
import { fetchOrgStructure } from "@/lib/inkai-api/admin-data";
import { prisma, withPrismaFallback } from "@/lib/prisma";
import { settingsUsernameLoadWarning } from "@/lib/prisma-errors";
import { getPrimaryAdminRole } from "@/lib/rbac";
import { AdminPageLoader } from "@/components/ui/AdminPageLoader";
import { SettingsKpiGrid } from "@/components/admin/pengaturan/SettingsKpiGrid";
import {
  SettingsPagination,
  SettingsSearchForm,
  paginateSlice,
  parsePage,
  parsePageSize,
} from "@/components/admin/pengaturan/SettingsTableToolbar";
import { RantingSettingsManager } from "./RantingSettingsManager";
import { SettingsLoadWarning } from "@/components/admin/pengaturan/SettingsLoadWarning";
import { Card, CardContent } from "@/components/ui/card";
import { loadPrimaryEmailsByWilayah } from "@/lib/wilayah-accounts";
import { Home, KeyRound, Users, Building2 } from "lucide-react";

export const dynamic = "force-dynamic";

const PAGE_SIZE_OPTIONS = [10, 50, 100];

type SearchParams = Promise<{
  q?: string;
  branchId?: string;
  login?: string;
  page?: string;
  pageSize?: string;
}>;

export default function PengaturanRantingPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <Suspense fallback={<AdminPageLoader rows={5} />}>
      <PengaturanRantingContent searchParams={searchParams} />
    </Suspense>
  );
}

async function PengaturanRantingContent({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { user, token } = await requireAdminSession();
  if (!canManageRanting(user)) redirect("/admin/pengaturan");

  const role = getPrimaryAdminRole(user.roles);
  // Admin ranting memakai halaman Pengaturan gabungan
  if (role === "ADMIN_DOJO") redirect("/admin/pengaturan");

  const params = await searchParams;
  const q = params.q?.trim().toLowerCase() || "";
  const branchFilter = params.branchId?.trim() || "";
  const loginFilter = params.login?.trim() || "";
  const page = parsePage(params.page);
  const pageSize = parsePageSize(params.pageSize, PAGE_SIZE_OPTIONS, 10);

  const lockedBranchId =
    role === "ADMIN_BRANCH" ? user.managedBranchId ?? null : null;
  const lockedDojoId =
    role === "ADMIN_DOJO" ? user.managedDojoId ?? null : null;
  const selfManagedOnly = role === "ADMIN_DOJO";

  const { branches, dojos } = await fetchOrgStructure(token);
  const loadPartial =
    branches.length === 0 && dojos.length === 0 ? "org" : null;

  let scopedBranches = branches.map((b) => ({
    id: String(b.id),
    name: String(b.name),
  }));
  let scopedDojos = dojos;

  if (lockedBranchId) {
    scopedBranches = scopedBranches.filter((b) => b.id === lockedBranchId);
    scopedDojos = dojos.filter((d) => {
      const branch = d.branch as { id?: string } | undefined;
      return String(branch?.id || "") === lockedBranchId;
    });
  }

  if (lockedDojoId) {
    scopedDojos = scopedDojos.filter((d) => String(d.id) === lockedDojoId);
    const own = scopedDojos[0];
    const branch = own?.branch as { id?: string; name?: string } | undefined;
    if (branch?.id) {
      scopedBranches = [
        { id: String(branch.id), name: String(branch.name || "Cabang") },
      ];
    }
  }

  if (selfManagedOnly && !lockedDojoId) {
    return (
      <>
        <div className="mb-6">
          <h2 className="text-2xl font-bold">Pengaturan Ranting & User</h2>
          <p className="text-muted-foreground">
            Akun Anda belum terhubung ke ranting.
          </p>
        </div>
        <Card>
          <CardContent className="space-y-3 p-6 text-sm text-muted-foreground">
            <p>
              Field <code className="text-foreground">managedDojoId</code> pada
              akun admin ranting masih kosong, sehingga data ranting tidak bisa
              ditampilkan atau diubah.
            </p>
            <p>
              Minta admin cabang membuka{" "}
              <strong className="text-foreground">Pengaturan Ranting</strong> dan
              memastikan akun login Anda terhubung ke ranting yang benar.
            </p>
          </CardContent>
        </Card>
      </>
    );
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
  let archivedDojos: Array<{
    id: string;
    name: string;
    branch: { name: string } | null;
  }> = [];

  if (dojoIds.length) {
    const adminsResult = await withPrismaFallback(
      "pengaturan-ranting-admins",
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

  if (!selfManagedOnly) {
    const archivedResult = await withPrismaFallback(
      "pengaturan-ranting-archived",
      () =>
        prisma.dojo.findMany({
          where: {
            isDeleted: true,
            ...(lockedBranchId ? { branchId: lockedBranchId } : {}),
          },
          select: {
            id: true,
            name: true,
            branch: { select: { name: true } },
          },
          orderBy: { name: "asc" },
          take: 50,
        }),
      [] as Array<{
        id: string;
        name: string;
        branch: { name: string } | null;
      }>,
    );
    archivedDojos = archivedResult.data;
  }

  const warning =
    loadPartial === "org"
      ? "Data organisasi belum berhasil dimuat (API sibuk/timeout). Tekan refresh sebentar lagi."
      : adminLoadFailed
        ? settingsUsernameLoadWarning("ranting", adminLoadError)
        : null;

  const adminsByDojo = new Map<
    string,
    Array<{ email: string; isActive: boolean }>
  >();
  for (const a of admins) {
    if (!a.managedDojoId) continue;
    const list = adminsByDojo.get(a.managedDojoId) ?? [];
    list.push({ email: a.email, isActive: a.isActive });
    adminsByDojo.set(a.managedDojoId, list);
  }

  const primaryResult = await withPrismaFallback(
    "pengaturan-ranting-primary",
    () =>
      loadPrimaryEmailsByWilayah({
        scope: "dojo",
        wilayahIds: dojoIds,
      }),
    new Map<string, string>(),
  );
  const primaryByDojo = primaryResult.data;

  const mapped = scopedDojos.map((d) => {
    const branch = d.branch as { id?: string; name?: string } | undefined;
    const id = String(d.id);
    const dojoAdmins = adminsByDojo.get(id) ?? [];
    const primaryEmail = primaryByDojo.get(id);
    const primary =
      (primaryEmail
        ? dojoAdmins.find((a) => a.email === primaryEmail)
        : null) ??
      dojoAdmins.find((a) => a.isActive) ??
      dojoAdmins[0] ??
      null;
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
      adminEmail: primary?.email ?? null,
      adminIsActive: primary?.isActive ?? null,
      adminCount: dojoAdmins.length,
      adminIsPrimary: Boolean(primaryEmail && primary?.email === primaryEmail),
    };
  });

  const filtered = mapped.filter((d) => {
    if (branchFilter && d.branchId !== branchFilter) return false;
    // Jangan filter status login jika data akun gagal dimuat (semua akan terlihat "belum").
    if (!adminLoadFailed) {
      if (loginFilter === "yes" && !(d.adminCount > 0)) return false;
      if (loginFilter === "no" && d.adminCount > 0) return false;
    }
    if (!q) return true;
    const adminEmails = (adminsByDojo.get(d.id) ?? [])
      .map((a) => a.email.toLowerCase())
      .join(" ");
    return (
      d.name.toLowerCase().includes(q) ||
      (d.headName || "").toLowerCase().includes(q) ||
      (d.branchName || "").toLowerCase().includes(q) ||
      (d.kecamatan || "").toLowerCase().includes(q) ||
      adminEmails.includes(q)
    );
  });

  const withLogin = adminLoadFailed
    ? null
    : mapped.filter((d) => d.adminCount > 0).length;
  const totalMembers = mapped.reduce((sum, d) => sum + (d.memberCount || 0), 0);
  const branchCount = new Set(mapped.map((d) => d.branchId).filter(Boolean)).size;

  const { rows, total, totalPages, page: safePage } = paginateSlice(
    filtered,
    page,
    pageSize,
  );

  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Pengaturan Ranting & User</h2>
        <p className="text-muted-foreground">
          {selfManagedOnly
            ? "Perbarui data ranting Anda (alamat, jadwal, rekening, dan kontak)."
            : "Kelola data ranting & akun login (email/password PIC). Multi-akun lewat tombol Akun."}
        </p>
      </div>

      {warning ? <SettingsLoadWarning message={warning} /> : null}

      <SettingsKpiGrid
        items={[
          { label: "Total Ranting", value: mapped.length, icon: Home },
          { label: "Cabang", value: branchCount, icon: Building2 },
          {
            label: "Punya Akun",
            value: withLogin === null ? "—" : withLogin,
            hint: withLogin === null ? "Data akun tidak tersedia" : undefined,
            icon: KeyRound,
          },
          { label: "Total Anggota", value: totalMembers, icon: Users },
        ]}
      />

      <SettingsSearchForm
        q={q}
        qPlaceholder="Cari nama, PIC, cabang, username..."
        {...(adminLoadFailed
          ? {}
          : {
              filterName: "login" as const,
              filterValue: loginFilter,
              filterLabel: "Status Login",
              filterOptions: [
                { value: "", label: "Semua" },
                { value: "yes", label: "Sudah punya login" },
                { value: "no", label: "Belum punya login" },
              ],
            })}
        extraHidden={{
          pageSize: String(pageSize),
          ...(!lockedBranchId && branchFilter ? { branchId: branchFilter } : {}),
        }}
      />

      {!lockedBranchId && scopedBranches.length > 1 ? (
        <form method="get" className="mb-4 -mt-2 flex flex-wrap items-end gap-2">
          {q ? <input type="hidden" name="q" value={q} /> : null}
          {loginFilter ? <input type="hidden" name="login" value={loginFilter} /> : null}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Cabang</label>
            <select
              name="branchId"
              defaultValue={branchFilter}
              className="h-8 min-w-[180px] rounded-lg border px-2 text-sm"
            >
              <option value="">Semua cabang</option>
              {scopedBranches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="h-8 rounded-lg border px-3 text-sm hover:bg-muted"
          >
            Filter Cabang
          </button>
        </form>
      ) : null}

      <RantingSettingsManager
        lockedBranchId={lockedBranchId}
        selfManagedOnly={selfManagedOnly}
        adminsUnavailable={adminLoadFailed}
        branches={scopedBranches}
        dojos={rows}
        archived={archivedDojos.map((d) => ({
          id: d.id,
          name: d.name,
          branchName: d.branch?.name || "—",
          memberCount: 0,
          adminEmail: null,
          adminIsActive: null,
          adminCount: 0,
        }))}
      />

      <SettingsPagination
        page={safePage}
        totalPages={totalPages}
        total={total}
        pageSize={pageSize}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
        baseParams={{
          q,
          login: loginFilter,
          ...(branchFilter ? { branchId: branchFilter } : {}),
        }}
      />
    </>
  );
}
