import { Suspense } from "react";
import { requireAdminSession } from "@/lib/admin-session";
import { getPrimaryAdminRole } from "@/lib/rbac";
import { canManageIuranByWilayah } from "@/lib/wilayah-rbac";
import { getManagedDojoIdsFromUser } from "@/lib/managed-dojos";
import { fetchBillings } from "@/lib/inkai-api/admin-data";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { BillingActions } from "./BillingActions";
import { AdminPageLoader } from "@/components/ui/AdminPageLoader";
import { IuranOpsBar } from "./IuranOpsBar";
import { getOperationalDefaults } from "@/lib/org-settings";
import { billingStatusLabel } from "@/lib/admin-labels";
import { OptimisticHide } from "@/components/admin/OptimisticHide";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ status?: string; q?: string; month?: string }>;

export default function AdminIuranPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <Suspense fallback={<AdminPageLoader rows={6} />}>
      <AdminIuranContent searchParams={searchParams} />
    </Suspense>
  );
}

async function AdminIuranContent({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { token, user } = await requireAdminSession();
  const params = await searchParams;
  const status = params.status?.trim() || "";
  const q = params.q?.trim() || "";
  const monthFilter = params.month?.trim() || "";
  const canEdit = canManageIuranByWilayah(user.roles ?? []);
  const role = getPrimaryAdminRole(user.roles ?? []);
  const managedDojoIds =
    role === "ADMIN_DOJO" ? getManagedDojoIdsFromUser(user) : [];
  const defaults = await getOperationalDefaults();

  let billings = await fetchBillings(token, {
    status: status || undefined,
    limit: 250,
  });

  // Scope ketua ranting ke anggota dojo yang dikelola
  if (role === "ADMIN_DOJO" && managedDojoIds.length > 0) {
    billings = billings.filter((b) => {
      const member = b.member as
        | { dojo?: { id?: string }; dojoId?: string }
        | undefined;
      const dojoId = member?.dojo?.id ?? member?.dojoId;
      if (!dojoId) return true;
      return managedDojoIds.includes(dojoId);
    });
  }

  if (monthFilter) {
    billings = billings.filter((b) => {
      const due = String(b.dueDate ?? "");
      const desc = String(b.description ?? "");
      return due.startsWith(monthFilter) || desc.includes(monthFilter);
    });
  }

  if (q) {
    const lower = q.toLowerCase();
    billings = billings.filter((b) => {
      const member = b.member as { fullName?: string; nia?: string } | undefined;
      return (
        member?.fullName?.toLowerCase().includes(lower) ||
        member?.nia?.toLowerCase().includes(lower)
      );
    });
  }

  const stats = billings.reduce<{ paid: number; waiting: number; pending: number }>(
    (acc, b) => {
      const amount = Number(b.amount ?? 0);
      if (b.status === "PAID") acc.paid += amount;
      else if (b.status === "WAITING_VERIFICATION") acc.waiting += 1;
      else if (b.status === "PENDING") acc.pending += 1;
      return acc;
    },
    { paid: 0, waiting: 0, pending: 0 },
  );

  const exportRows = billings.map((b) => {
    const member = b.member as {
      fullName?: string;
      nia?: string;
      dojo?: { name?: string };
    } | undefined;
    return {
      id: String(b.id),
      fullName: member?.fullName ?? "",
      nia: member?.nia ?? "",
      dojo: member?.dojo?.name ?? "",
      type: String(b.type ?? ""),
      amount: Number(b.amount ?? 0),
      status: String(b.status ?? ""),
      dueDate: new Date(String(b.dueDate)).toLocaleDateString("id-ID"),
      description: b.description != null ? String(b.description) : "",
    };
  });

  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Iuran & Tagihan Anggota</h2>
        <p className="text-muted-foreground">
          Total lunas: Rp {stats.paid.toLocaleString("id-ID")} · Menunggu
          verifikasi: {stats.waiting} · Belum bayar: {stats.pending}
        </p>
        {canEdit ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Ketua ranting/cabang dapat <strong>mengedit</strong> nominal & jatuh
            tempo, <strong>menandai lunas</strong> (tunai), serta menyetujui/menolak
            bukti transfer.
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">
            Mode lihat saja — kelola iuran dilakukan oleh ranting/cabang.
          </p>
        )}
      </div>

      <IuranOpsBar
        canEdit={canEdit}
        defaultAmount={defaults.monthlyDuesAmount}
        billings={exportRows}
      />

      <form className="mb-4 flex flex-wrap gap-2">
        <Input
          name="q"
          placeholder="Cari nama / NIA..."
          defaultValue={q}
          className="max-w-xs"
        />
        <Input
          name="month"
          type="month"
          defaultValue={monthFilter}
          className="max-w-[160px]"
          title="Filter bulan (jatuh tempo / keterangan)"
        />
        <select
          name="status"
          defaultValue={status}
          className="h-8 rounded-lg border px-2 text-sm"
        >
          <option value="">Semua status</option>
          <option value="PENDING">Belum bayar</option>
          <option value="WAITING_VERIFICATION">Menunggu verifikasi</option>
          <option value="PAID">Lunas</option>
          <option value="REJECTED">Ditolak</option>
        </select>
        <button
          type="submit"
          className="rounded-lg bg-inkai-red px-4 py-1.5 text-sm text-white"
        >
          Filter
        </button>
      </form>

      {billings.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Tidak ada data iuran.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {billings.map((b) => {
            const member = b.member as {
              fullName?: string;
              nia?: string;
              dojo?: { name?: string };
            } | undefined;
            const payment = b.payment as { proofUrl?: string } | null | undefined;
            return (
              <OptimisticHide key={String(b.id)}>
                <Card>
                  <CardContent className="flex flex-wrap items-start justify-between gap-3 p-4">
                    <div>
                      <p className="font-medium">{member?.fullName ?? "—"}</p>
                      <p className="text-sm text-muted-foreground">
                        {member?.nia || "—"} · {member?.dojo?.name ?? "—"} ·{" "}
                        {String(b.type)}
                      </p>
                      {b.description != null && String(b.description) !== "" && (
                        <p className="text-sm text-muted-foreground">
                          {String(b.description)}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Jatuh tempo:{" "}
                        {new Date(String(b.dueDate)).toLocaleDateString("id-ID")}
                      </p>
                      {payment?.proofUrl && (
                        <a
                          href={payment.proofUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-inkai-red hover:underline"
                        >
                          Lihat bukti transfer
                        </a>
                      )}
                    </div>
                    <div className="flex min-w-[200px] flex-col items-end gap-2">
                      <p className="font-bold">
                        Rp {Number(b.amount).toLocaleString("id-ID")}
                      </p>
                      <Badge
                        variant={b.status === "PAID" ? "default" : "secondary"}
                      >
                        {billingStatusLabel(String(b.status))}
                      </Badge>
                      <BillingActions
                        billingId={String(b.id)}
                        status={String(b.status)}
                        amount={Number(b.amount)}
                        dueDate={String(b.dueDate)}
                        description={
                          b.description != null ? String(b.description) : null
                        }
                        canEdit={canEdit}
                      />
                    </div>
                  </CardContent>
                </Card>
              </OptimisticHide>
            );
          })}
        </div>
      )}
    </>
  );
}
