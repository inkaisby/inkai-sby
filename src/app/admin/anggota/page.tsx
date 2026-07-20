import { Suspense } from "react";
import Link from "next/link";
import { requireAdminSession } from "@/lib/admin-session";
import {
  getPrimaryAdminRole,
  ROLE_LABELS,
} from "@/lib/rbac";
import {
  fetchAdminDojosScopedCached,
  fetchAdminMembersScoped,
  fetchAdminMemberStatusCountsCached,
} from "@/lib/inkai-api/admin-data";
import {
  getManagedDojoIdsFromUser,
  resolveActiveDojoId,
} from "@/lib/managed-dojos";
import {
  getMemberLifecycles,
  monthsSince,
} from "@/lib/member-lifecycle";
import { parsePage, parsePageSize } from "@/components/admin/pengaturan/SettingsTableToolbar";
import { DojoContextSwitcher } from "@/components/admin/DojoContextSwitcher";
import { ArchivedMembersPanel } from "./ArchivedMembersPanel";
import { AnggotaBrowser } from "./AnggotaBrowser";
import { AdminPageLoader } from "@/components/ui/AdminPageLoader";
import { canEditKyuBaru } from "@/lib/belt";
import { canSoftDeleteMembers } from "@/lib/wilayah-rbac";

export const dynamic = "force-dynamic";

const PAGE_SIZE_OPTIONS = [25, 50, 100, 1000];

type SearchParams = Promise<{
  q?: string;
  status?: string;
  dojoId?: string;
  docs?: string;
  nia?: string;
  inactiveMonths?: string;
  view?: string;
  page?: string;
  pageSize?: string;
}>;

export default function AdminAnggotaPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <Suspense fallback={<AdminPageLoader rows={6} />}>
      <AdminAnggotaContent searchParams={searchParams} />
    </Suspense>
  );
}

async function AdminAnggotaContent({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { user } = await requireAdminSession();

  const params = await searchParams;
  const q = params.q?.trim() || "";
  const status = params.status?.trim() || "";
  const docs = params.docs === "incomplete" ? "incomplete" : "";
  const niaFilter = params.nia === "missing" ? "missing" : "";
  const view = params.view === "archive" ? "archive" : "";
  const inactiveMonthsRaw = Number(params.inactiveMonths || 0);
  const inactiveMonths =
    inactiveMonthsRaw === 3 ||
    inactiveMonthsRaw === 6 ||
    inactiveMonthsRaw === 12
      ? inactiveMonthsRaw
      : 0;
  const page = parsePage(params.page);
  const pageSize = parsePageSize(params.pageSize, PAGE_SIZE_OPTIONS, 25);

  const primaryRole = getPrimaryAdminRole(user.roles);
  const isDojoAdmin = primaryRole === "ADMIN_DOJO";
  const allowlist = getManagedDojoIdsFromUser(user);
  const resolved = resolveActiveDojoId(user, params.dojoId);
  const activeDojoId =
    resolved.ok && isDojoAdmin
      ? resolved.activeDojoId
      : params.dojoId?.trim() || "";
  const dojoId = isDojoAdmin
    ? activeDojoId || ""
    : params.dojoId?.trim() || "";
  const singleLockedDojo =
    isDojoAdmin && allowlist.length === 1 ? allowlist[0] : "";
  const canArchive = canSoftDeleteMembers(user.roles ?? []);

  if (view === "archive") {
    return (
      <>
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold">Arsip Anggota</h2>
            <p className="text-muted-foreground">
              Soft-delete — pulihkan ke status Nonaktif bila perlu.
            </p>
          </div>
          <Link
            href="/admin/anggota"
            className="inline-flex h-8 items-center rounded-lg border px-3 text-sm hover:bg-muted"
          >
            Kembali ke daftar
          </Link>
        </div>
        <ArchivedMembersPanel
          userRoles={user.roles}
          defaultDojoId={singleLockedDojo || dojoId}
        />
      </>
    );
  }

  const scopeOpts = {
    dojoId: dojoId || undefined,
    dojoIds:
      isDojoAdmin && !dojoId && allowlist.length > 0 ? allowlist : undefined,
  };

  const [result, dojos, statusCounts] = await Promise.all([
    fetchAdminMembersScoped(user, {
      page,
      limit: pageSize,
      search: q || undefined,
      status: status || undefined,
      ...scopeOpts,
      docsIncomplete: docs === "incomplete",
      missingNia: niaFilter === "missing",
    }),
    fetchAdminDojosScopedCached(user),
    fetchAdminMemberStatusCountsCached(user, scopeOpts),
  ]);

  const managedDojoOptions = isDojoAdmin ? dojos : [];

  let members = result.ok ? result.members : [];
  if (inactiveMonths > 0) {
    const lifecycles = await getMemberLifecycles(members.map((m) => m.id));
    members = members.filter((m) => {
      const st = m.status.trim().toUpperCase();
      if (st !== "INACTIVE" && st !== "SUSPENDED") return false;
      const meta = lifecycles.get(m.id);
      const months = monthsSince(meta?.changedAt);
      return months != null && months >= inactiveMonths;
    });
  }

  const total = result.ok ? result.total : 0;
  const subtitleTotal =
    !q && !status && !docs && !niaFilter && !inactiveMonths
      ? statusCounts.all
      : total;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Kelola Anggota</h2>
          <p className="text-muted-foreground">
            {ROLE_LABELS[primaryRole] || primaryRole} — {subtitleTotal} anggota
            {allowlist.length > 1 && !dojoId
              ? ` · ${allowlist.length} ranting`
              : dojoId
                ? ` · ${
                    managedDojoOptions.find((d) => d.id === dojoId)?.name ||
                    dojos.find((d) => d.id === dojoId)?.name ||
                    "Dojo"
                  }`
                : ""}
          </p>
          {!result.ok && (
            <p className="mt-2 text-sm text-destructive">
              Gagal memuat data anggota.
            </p>
          )}
        </div>
        {isDojoAdmin && managedDojoOptions.length > 1 ? (
          <DojoContextSwitcher
            dojos={managedDojoOptions}
            value={dojoId}
            label="Kelola ranting"
          />
        ) : null}
      </div>

      <AnggotaBrowser
        initialMembers={members}
        initialTotal={
          inactiveMonths > 0 ? members.length : total
        }
        initialStatusCounts={statusCounts}
        initialFilters={{
          q,
          status,
          dojoId: singleLockedDojo ? "" : dojoId,
          docs,
          nia: niaFilter,
          inactiveMonths: inactiveMonths ? String(inactiveMonths) : "",
          page,
          pageSize,
        }}
        dojos={dojos.map((d) => ({ id: d.id, name: d.name }))}
        userRoles={user.roles}
        showDojoFilter={!singleLockedDojo && !isDojoAdmin}
        lockDojoId={
          singleLockedDojo ||
          (isDojoAdmin && allowlist.length > 1 ? dojoId : "")
        }
        singleLockedDojo={singleLockedDojo}
        canArchive={canArchive}
        canNormalize={canEditKyuBaru(user.roles ?? [])}
        defaultDojoId={singleLockedDojo || dojoId || ""}
      />
    </>
  );
}
