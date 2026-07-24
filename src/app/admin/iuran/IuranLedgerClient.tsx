"use client";

import { useCallback, useEffect, useMemo, useState, startTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { OptimisticHide } from "@/components/admin/OptimisticHide";
import { SettingsPagination } from "@/components/admin/pengaturan/SettingsTableToolbar";
import {
  agingLabel,
  monthStatusLabel,
  type ArrearsAging,
  type IuranLedgerMemberRow,
  type MonthStatus,
  type WaitingQueueItem,
} from "@/lib/iuran-ledger";
import { showError, showSuccess } from "@/lib/client-toast";
import { Loader2 } from "lucide-react";
import {
  MemberIuranSheet,
  type IuranSheetTab,
} from "./MemberIuranSheet";

function formatRp(n: number) {
  return `Rp ${Math.round(n).toLocaleString("id-ID")}`;
}

function monthStatusBadgeClass(status: MonthStatus) {
  switch (status) {
    case "PAID":
      return "border-emerald-300 text-emerald-800";
    case "WAITING":
      return "border-amber-300 text-amber-900";
    case "PENDING":
    case "REJECTED":
      return "border-red-200 text-red-800";
    case "EXEMPT":
      return "border-amber-200 bg-amber-50 text-amber-900";
    case "NO_BILL":
      return "border-slate-200 text-slate-700";
    default:
      return "";
  }
}

function parseTab(raw: string | null): IuranSheetTab {
  if (raw === "pengaturan" || raw === "mutasi" || raw === "pembayaran") {
    return raw;
  }
  return "mutasi";
}

function rowSelectable(row: IuranLedgerMemberRow) {
  return (
    !row.allowEventWithoutDues &&
    (row.monthStatus === "PENDING" ||
      row.monthStatus === "WAITING" ||
      row.monthStatus === "REJECTED" ||
      row.arrearsAmount > 0)
  );
}

export function IuranLedgerClient({
  rows,
  total,
  page,
  pageSize,
  canEdit,
  defaultDuesAmount,
  waitingQueue,
  baseParams,
  periodKey,
  initialMemberId,
  initialTab,
}: {
  rows: IuranLedgerMemberRow[];
  total: number;
  page: number;
  pageSize: number;
  canEdit: boolean;
  defaultDuesAmount: number;
  waitingQueue: WaitingQueueItem[];
  baseParams: Record<string, string>;
  periodKey: string;
  initialMemberId?: string;
  initialTab?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [memberId, setMemberId] = useState<string | null>(
    initialMemberId || null,
  );
  const [tab, setTab] = useState<IuranSheetTab>(parseTab(initialTab ?? null));
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => {
    setMemberId(initialMemberId || null);
    setTab(parseTab(initialTab ?? null));
  }, [initialMemberId, initialTab]);

  useEffect(() => {
    setSelected(new Set());
  }, [page, pageSize, periodKey, rows]);

  const selectableRows = useMemo(
    () => rows.filter(rowSelectable),
    [rows],
  );

  const syncUrl = useCallback(
    (nextMemberId: string | null, nextTab: IuranSheetTab) => {
      const params = new URLSearchParams(searchParams.toString());
      if (nextMemberId) {
        params.set("memberId", nextMemberId);
        params.set("tab", nextTab);
      } else {
        params.delete("memberId");
        params.delete("tab");
      }
      const qs = params.toString();
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    },
    [pathname, router, searchParams],
  );

  function openMember(id: string, nextTab: IuranSheetTab = "mutasi") {
    setMemberId(id);
    setTab(nextTab);
    syncUrl(id, nextTab);
  }

  function closeSheet() {
    setMemberId(null);
    syncUrl(null, "mutasi");
  }

  function onTabChange(next: IuranSheetTab) {
    setTab(next);
    if (memberId) syncUrl(memberId, next);
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size >= selectableRows.length) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(selectableRows.map((r) => r.id)));
  }

  async function bulkMarkPaid() {
    const ids = Array.from(selected);
    if (ids.length === 0) {
      showError("Pilih minimal satu anggota");
      return;
    }
    const [y, m] = periodKey.split("-").map(Number);
    const ok = window.confirm(
      `Tandai lunas tunai iuran ${periodKey} untuk ${ids.length} anggota?`,
    );
    if (!ok) return;

    setBulkBusy(true);
    try {
      const res = await fetch("/api/admin/billing/bulk-mark-paid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberIds: ids,
          year: y,
          month: m,
          adminNotes: `Lunas tunai massal ${periodKey}`,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showError(data.error || "Gagal lunas massal");
        return;
      }
      showSuccess(data.message || "Berhasil");
      setSelected(new Set());
      startTransition(() => router.refresh());
    } finally {
      setBulkBusy(false);
    }
  }

  async function quickApprove(billingId: string) {
    setApprovingId(billingId);
    try {
      const res = await fetch(`/api/admin/billing/${billingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showError(data.error || "Gagal menyetujui");
        return;
      }
      showSuccess(data.message || "Bukti disetujui");
      startTransition(() => router.refresh());
    } finally {
      setApprovingId(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startNo = (page - 1) * pageSize;

  const paginationParams = useMemo(() => {
    const p = { ...baseParams };
    delete p.memberId;
    delete p.tab;
    return p;
  }, [baseParams]);

  return (
    <>
      {waitingQueue.length > 0 ? (
        <Card className="mb-4 border-amber-200 bg-amber-50/40">
          <CardContent className="space-y-2 p-3 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-amber-950">
                Perlu aksi — menunggu verifikasi ({waitingQueue.length})
              </p>
            </div>
            <ul className="space-y-2">
              {waitingQueue.map((item) => (
                <OptimisticHide key={item.billingId}>
                  <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200/80 bg-background px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <button
                        type="button"
                        className="font-medium text-inkai-red hover:underline"
                        onClick={() => openMember(item.memberId, "pembayaran")}
                      >
                        {item.fullName}
                      </button>
                      <p className="text-xs text-muted-foreground">
                        {item.nia || "—"} · {item.dojoName} ·{" "}
                        {formatRp(item.amount)}
                        {item.description ? ` · ${item.description}` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.paymentMethod === "SETOR_RANTING"
                          ? "Setor ranting"
                          : item.paymentMethod === "CASH"
                            ? "Tunai"
                            : item.paymentMethod === "TRANSFER"
                              ? "Transfer"
                              : item.paymentMethod || "Menunggu verifikasi"}
                        {item.paidAt
                          ? ` · Tgl setor ${new Date(item.paidAt).toLocaleDateString("id-ID")}`
                          : ""}
                        {item.proofUrl && item.proofUrl !== "—" ? (
                          <>
                            {" · "}
                            <a
                              href={item.proofUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-inkai-red hover:underline"
                            >
                              Bukti
                            </a>
                          </>
                        ) : null}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8"
                        onClick={() => openMember(item.memberId, "pembayaran")}
                      >
                        Buka rekening
                      </Button>
                      {canEdit ? (
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 bg-green-600 hover:bg-green-700"
                          disabled={approvingId === item.billingId}
                          onClick={() => void quickApprove(item.billingId)}
                        >
                          {approvingId === item.billingId ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            "Setujui"
                          )}
                        </Button>
                      ) : null}
                    </div>
                  </li>
                </OptimisticHide>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {canEdit && selected.size > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/50 px-3 py-2 text-sm">
          <span className="font-medium text-emerald-950">
            {selected.size} anggota dipilih
          </span>
          <Button
            type="button"
            size="sm"
            className="h-8 bg-emerald-700 hover:bg-emerald-800"
            disabled={bulkBusy}
            onClick={() => void bulkMarkPaid()}
          >
            {bulkBusy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              `Tandai lunas tunai (${periodKey})`
            )}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8"
            disabled={bulkBusy}
            onClick={() => setSelected(new Set())}
          >
            Batal
          </Button>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Tidak ada data anggota untuk filter ini.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {rows.map((row, idx) => (
              <MemberCard
                key={row.id}
                row={row}
                no={startNo + idx + 1}
                canSelect={canEdit && rowSelectable(row)}
                selected={selected.has(row.id)}
                onToggleSelect={() => toggleSelect(row.id)}
                onOpen={() => openMember(row.id, "mutasi")}
              />
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-xl border md:block">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  {canEdit ? (
                    <th className="px-3 py-2.5 font-medium">
                      <input
                        type="checkbox"
                        aria-label="Pilih semua di halaman"
                        checked={
                          selectableRows.length > 0 &&
                          selected.size >= selectableRows.length
                        }
                        onChange={toggleSelectAll}
                      />
                    </th>
                  ) : null}
                  <th className="px-3 py-2.5 font-medium">No</th>
                  <th className="px-3 py-2.5 font-medium">Nama</th>
                  <th className="px-3 py-2.5 font-medium">NIA</th>
                  <th className="px-3 py-2.5 font-medium">Ranting</th>
                  <th className="px-3 py-2.5 text-right font-medium">Iuran/bln</th>
                  <th className="px-3 py-2.5 font-medium">Status bulan</th>
                  <th className="px-3 py-2.5 text-right font-medium">Tunggakan</th>
                  <th className="px-3 py-2.5 font-medium">Aging</th>
                  <th className="px-3 py-2.5 font-medium">Pengecualian</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr
                    key={row.id}
                    className="border-b last:border-0 hover:bg-muted/30"
                  >
                    {canEdit ? (
                      <td className="px-3 py-2.5">
                        {rowSelectable(row) ? (
                          <input
                            type="checkbox"
                            aria-label={`Pilih ${row.fullName}`}
                            checked={selected.has(row.id)}
                            onChange={() => toggleSelect(row.id)}
                          />
                        ) : null}
                      </td>
                    ) : null}
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {startNo + idx + 1}
                    </td>
                    <td className="px-3 py-2.5">
                      <button
                        type="button"
                        className="font-medium text-inkai-red hover:underline"
                        onClick={() => openMember(row.id, "mutasi")}
                      >
                        {row.fullName}
                      </button>
                      {row.waitingCount > 0 ? (
                        <span className="mt-0.5 block text-[11px] text-amber-800">
                          {row.waitingCount} menunggu verifikasi
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">
                      {row.nia || "—"}
                    </td>
                    <td className="px-3 py-2.5">{row.dojoName}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {formatRp(row.monthlyDuesAmount)}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge
                        variant="outline"
                        className={monthStatusBadgeClass(row.monthStatus)}
                      >
                        {monthStatusLabel(row.monthStatus)}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium tabular-nums">
                      {row.arrearsAmount > 0
                        ? formatRp(row.arrearsAmount)
                        : "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      {row.aging === "none" ? (
                        "—"
                      ) : (
                        <Badge variant="secondary">
                          {agingLabel(row.aging)}
                        </Badge>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {row.allowEventWithoutDues ? (
                        <span
                          className="inline-flex max-w-[200px] flex-col gap-0.5"
                          title="Tidak wajib lunas iuran untuk daftar event/UKT atau lainnya"
                        >
                          <Badge className="w-fit bg-amber-100 text-amber-900 hover:bg-amber-100">
                            Ya
                          </Badge>
                          <span className="text-[10px] leading-snug text-muted-foreground">
                            Tidak wajib lunas iuran untuk daftar event/UKT atau
                            lainnya
                          </span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Tidak</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <SettingsPagination
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={pageSize}
            pageSizeOptions={[25, 50, 100]}
            baseParams={paginationParams}
            onNavigate={(href) => {
              startTransition(() => router.push(href));
            }}
          />
        </>
      )}

      <MemberIuranSheet
        memberId={memberId}
        open={!!memberId}
        onOpenChange={(open) => {
          if (!open) closeSheet();
        }}
        tab={tab}
        onTabChange={onTabChange}
        canEdit={canEdit}
        defaultDuesAmount={defaultDuesAmount}
      />
    </>
  );
}

function MemberCard({
  row,
  no,
  onOpen,
  canSelect,
  selected,
  onToggleSelect,
}: {
  row: IuranLedgerMemberRow;
  no: number;
  onOpen: () => void;
  canSelect?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}) {
  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2">
            {canSelect ? (
              <input
                type="checkbox"
                className="mt-1"
                checked={selected}
                onChange={onToggleSelect}
                aria-label={`Pilih ${row.fullName}`}
              />
            ) : null}
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">#{no}</p>
              <button
                type="button"
                className="text-left font-medium text-inkai-red hover:underline"
                onClick={onOpen}
              >
                {row.fullName}
              </button>
              <p className="text-xs text-muted-foreground">
                {row.nia || "—"} · {row.dojoName}
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className={monthStatusBadgeClass(row.monthStatus)}
          >
            {monthStatusLabel(row.monthStatus)}
          </Badge>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <p className="text-muted-foreground">Iuran/bln</p>
            <p className="font-medium">{formatRp(row.monthlyDuesAmount)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Tunggakan</p>
            <p className="font-medium">
              {row.arrearsAmount > 0 ? formatRp(row.arrearsAmount) : "—"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Aging</p>
            <p>{agingLabel(row.aging as ArrearsAging)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Pengecualian</p>
            <p>
              {row.allowEventWithoutDues
                ? "Ya — tidak wajib lunas event/UKT"
                : "Tidak"}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
