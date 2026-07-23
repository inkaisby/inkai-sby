"use client";

import { useCallback, useEffect, useState, startTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { billingStatusLabel } from "@/lib/admin-labels";
import {
  agingLabel,
  type ArrearsAging,
  type IuranLedgerBilling,
} from "@/lib/iuran-ledger";
import { showError, showSuccess } from "@/lib/client-toast";
import { Loader2 } from "lucide-react";
import { BillingActions } from "./BillingActions";

export type IuranSheetTab = "pengaturan" | "mutasi" | "pembayaran";

type LedgerDetail = {
  member: {
    id: string;
    fullName: string;
    nia: string | null;
    status: string;
    dojoId: string;
    dojoName: string;
    monthlyDuesAmount: number;
    allowEventWithoutDues: boolean;
    isDeleted: boolean;
  };
  summary: {
    arrearsAmount: number;
    arrearsCount: number;
    paidYearAmount: number;
    paidYearCount: number;
    aging: ArrearsAging;
  };
  billings: IuranLedgerBilling[];
  auditTrail?: Array<{
    id: string;
    action: string;
    email: string | null;
    details: string | null;
    createdAt: string;
  }>;
  total: number;
};

function formatRp(n: number) {
  return `Rp ${Math.round(n).toLocaleString("id-ID")}`;
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("id-ID");
  } catch {
    return "—";
  }
}

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("id-ID");
  } catch {
    return "—";
  }
}

function auditActionLabel(action: string, details: string | null) {
  const d = details || "";
  if (d.includes("billingAction=mark_paid") || d.includes("mark_paid")) {
    return "Tandai lunas";
  }
  if (d.includes("billingAction=approve") || /\bapprove\b/.test(d)) {
    return "Setujui bukti";
  }
  if (d.includes("billingAction=reject") || /\breject\b/.test(d)) {
    return "Tolak bukti";
  }
  if (action === "BILLING_UPDATE") return "Edit tagihan";
  if (action === "BILLING_SUBMIT_VERIFICATION") return "Ajukan verifikasi";
  return action.replace(/^BILLING_/, "");
}

function extractNotes(details: string | null) {
  if (!details) return "";
  const m = details.match(/notes=([^\n]*?)(?=\s+\w+=|$)/);
  return m?.[1]?.trim() || "";
}

const UNPAID = new Set(["PENDING", "WAITING_VERIFICATION", "REJECTED"]);
const PAID = new Set(["PAID", "SUCCESS", "APPROVED"]);

export function MemberIuranSheet({
  memberId,
  open,
  onOpenChange,
  tab,
  onTabChange,
  canEdit,
  defaultDuesAmount,
}: {
  memberId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tab: IuranSheetTab;
  onTabChange: (tab: IuranSheetTab) => void;
  canEdit: boolean;
  defaultDuesAmount: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<LedgerDetail | null>(null);
  const [duesAmount, setDuesAmount] = useState("");
  const [duesSaving, setDuesSaving] = useState(false);
  const [exemptSaving, setExemptSaving] = useState(false);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/iuran/members/${id}?limit=120`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showError(data.error || "Gagal memuat rekening iuran");
        setDetail(null);
        return;
      }
      setDetail(data as LedgerDetail);
      setDuesAmount(
        String(Math.round(Number(data.member?.monthlyDuesAmount ?? 0))),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && memberId) void load(memberId);
    if (!open) setDetail(null);
  }, [open, memberId, load]);

  function refreshAll() {
    if (memberId) void load(memberId);
    startTransition(() => router.refresh());
  }

  async function saveDues() {
    if (!memberId) return;
    const amount = Number(duesAmount);
    if (!Number.isFinite(amount) || amount < 0) {
      showError("Nominal tidak valid");
      return;
    }
    setDuesSaving(true);
    try {
      const res = await fetch(`/api/admin/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_dues", monthlyDuesAmount: amount }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showError(data.error || "Gagal menyimpan iuran/bln");
        return;
      }
      showSuccess(data.message || "Iuran/bln disimpan");
      refreshAll();
    } finally {
      setDuesSaving(false);
    }
  }

  async function saveExempt(checked: boolean) {
    if (!memberId) return;
    setExemptSaving(true);
    try {
      const res = await fetch(`/api/admin/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_dues_exemption",
          allowEventWithoutDues: checked,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showError(data.error || "Gagal menyimpan pengecualian iuran");
        return;
      }
      showSuccess(
        checked
          ? "Pengecualian aktif — tidak wajib lunas untuk event/UKT"
          : "Pengecualian dimatikan",
      );
      refreshAll();
    } finally {
      setExemptSaving(false);
    }
  }

  const unpaidBillings =
    detail?.billings.filter((b) => UNPAID.has(b.status)) ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-xl lg:max-w-2xl"
      >
        <SheetHeader className="border-b px-4 py-4 sm:px-6">
          <SheetTitle className="pr-8 text-left">
            {detail?.member.fullName ?? "Rekening iuran"}
          </SheetTitle>
          <SheetDescription className="text-left">
            {detail
              ? `${detail.member.nia || "Tanpa NIA"} · ${detail.member.dojoName}`
              : "Memuat data anggota…"}
          </SheetDescription>
        </SheetHeader>

        {loading && !detail ? (
          <div className="flex flex-1 items-center justify-center p-8 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Memuat rekening…
          </div>
        ) : detail ? (
          <div className="flex flex-1 flex-col px-4 py-4 sm:px-6">
            <div className="mb-4 flex flex-wrap gap-2 text-xs">
              <Badge variant="outline">
                Tunggakan: {formatRp(detail.summary.arrearsAmount)}
              </Badge>
              <Badge variant="outline">
                Dibayar {new Date().getFullYear()}:{" "}
                {formatRp(detail.summary.paidYearAmount)}
              </Badge>
              <Badge variant="outline">
                Iuran/bln: {formatRp(detail.member.monthlyDuesAmount)}
              </Badge>
              {detail.summary.aging !== "none" ? (
                <Badge variant="secondary">
                  Aging {agingLabel(detail.summary.aging)}
                </Badge>
              ) : null}
              {detail.member.allowEventWithoutDues ? (
                <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">
                  Pengecualian aktif
                </Badge>
              ) : null}
            </div>

            <Tabs
              value={tab}
              onValueChange={(v) => onTabChange(v as IuranSheetTab)}
              className="flex min-h-0 flex-1 flex-col"
            >
              <TabsList className="mb-3 grid w-full grid-cols-3">
                <TabsTrigger value="pengaturan">Pengaturan</TabsTrigger>
                <TabsTrigger value="mutasi">Mutasi</TabsTrigger>
                <TabsTrigger value="pembayaran">Pembayaran</TabsTrigger>
              </TabsList>

              <TabsContent value="pengaturan" className="space-y-4">
                <div className="space-y-2 rounded-lg border p-3">
                  <label className="text-xs font-medium">Iuran per bulan (Rp)</label>
                  <div className="flex flex-wrap gap-2">
                    <Input
                      type="number"
                      className="h-9 max-w-[180px]"
                      value={duesAmount}
                      disabled={!canEdit || duesSaving}
                      onChange={(e) => setDuesAmount(e.target.value)}
                    />
                    {canEdit ? (
                      <Button
                        size="sm"
                        className="h-9 bg-inkai-red hover:bg-inkai-red/90"
                        disabled={duesSaving}
                        onClick={() => void saveDues()}
                      >
                        {duesSaving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Simpan"
                        )}
                      </Button>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Default organisasi: {formatRp(defaultDuesAmount)}. Generate
                    tagihan bulan berikutnya memakai nominal ini.
                  </p>
                </div>

                <div className="space-y-2 rounded-lg border p-3">
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={detail.member.allowEventWithoutDues}
                      disabled={!canEdit || exemptSaving}
                      onChange={(e) => void saveExempt(e.target.checked)}
                    />
                    <span>
                      <span className="font-medium">Pengecualian iuran</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        Tidak wajib lunas iuran untuk daftar event/UKT atau
                        lainnya. Anggota dilewati saat generate tagihan bulanan.
                      </span>
                    </span>
                  </label>
                </div>

                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Status</dt>
                    <dd>{detail.member.status}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Ranting</dt>
                    <dd>{detail.member.dojoName}</dd>
                  </div>
                </dl>
              </TabsContent>

              <TabsContent value="mutasi" className="space-y-3">
                {detail.billings.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Belum ada mutasi iuran bulanan.
                    {detail.member.allowEventWithoutDues
                      ? " Anggota berstatus pengecualian (skip generate)."
                      : ""}
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full min-w-[520px] text-left text-sm">
                      <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                        <tr>
                          <th className="px-2 py-2 font-medium">Periode / JT</th>
                          <th className="px-2 py-2 font-medium">Keterangan</th>
                          <th className="px-2 py-2 text-right font-medium">Debit</th>
                          <th className="px-2 py-2 text-right font-medium">Kredit</th>
                          <th className="px-2 py-2 font-medium">Status</th>
                          <th className="px-2 py-2 font-medium">Metode</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.billings.map((b) => {
                          const paid = PAID.has(b.status);
                          return (
                            <tr key={b.id} className="border-b last:border-0">
                              <td className="px-2 py-2 whitespace-nowrap">
                                {formatDate(b.dueDate)}
                              </td>
                              <td className="max-w-[160px] truncate px-2 py-2">
                                {b.description || "Iuran bulanan"}
                              </td>
                              <td className="px-2 py-2 text-right tabular-nums">
                                {formatRp(b.amount)}
                              </td>
                              <td className="px-2 py-2 text-right tabular-nums text-emerald-700">
                                {paid ? formatRp(b.amount) : "—"}
                              </td>
                              <td className="px-2 py-2">
                                <Badge variant="outline" className="text-[10px]">
                                  {billingStatusLabel(b.status)}
                                </Badge>
                              </td>
                              <td className="px-2 py-2 text-xs">
                                {b.payment?.paymentMethod || "—"}
                                {b.payment?.proofUrl ? (
                                  <>
                                    {" · "}
                                    <a
                                      href={b.payment.proofUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-inkai-red hover:underline"
                                    >
                                      Bukti
                                    </a>
                                  </>
                                ) : null}
                                {canEdit && UNPAID.has(b.status) ? (
                                  <div className="mt-1">
                                    <BillingActions
                                      billingId={b.id}
                                      status={b.status}
                                      amount={b.amount}
                                      dueDate={b.dueDate}
                                      description={b.description}
                                      canEdit={canEdit}
                                    />
                                  </div>
                                ) : null}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Menampilkan {detail.billings.length} dari {detail.total}{" "}
                  mutasi iuran bulanan (UKT/event tidak disertakan).
                </p>
                <AuditTrailList entries={detail.auditTrail ?? []} />
              </TabsContent>

              <TabsContent value="pembayaran" className="space-y-3">
                {unpaidBillings.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Tidak ada tagihan yang perlu diproses.
                  </p>
                ) : (
                  unpaidBillings.map((b) => (
                    <div
                      key={b.id}
                      className="space-y-2 rounded-lg border p-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">
                            {b.description || "Iuran bulanan"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            JT {formatDate(b.dueDate)} · {formatRp(b.amount)}
                          </p>
                          {b.payment?.proofUrl ? (
                            <a
                              href={b.payment.proofUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-inkai-red hover:underline"
                            >
                              Lihat bukti transfer
                            </a>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              Belum ada bukti unggahan
                            </p>
                          )}
                        </div>
                        <Badge variant="secondary">
                          {billingStatusLabel(b.status)}
                        </Badge>
                      </div>
                      <BillingActions
                        billingId={b.id}
                        status={b.status}
                        amount={b.amount}
                        dueDate={b.dueDate}
                        description={b.description}
                        canEdit={canEdit}
                      />
                    </div>
                  ))
                )}
                <AuditTrailList entries={detail.auditTrail ?? []} />
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <p className="p-6 text-sm text-muted-foreground">
            Data rekening tidak tersedia.
          </p>
        )}
      </SheetContent>
    </Sheet>
  );
}

function AuditTrailList({
  entries,
}: {
  entries: NonNullable<LedgerDetail["auditTrail"]>;
}) {
  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-3">
        <p className="text-xs font-medium text-muted-foreground">Jejak aksi</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Belum ada jejak lokal. Aksi setujui/tolak/lunas berikutnya akan
          tercatat di sini (siapa, kapan, catatan).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Jejak aksi
      </p>
      <ul className="max-h-40 space-y-2 overflow-y-auto rounded-lg border p-2 text-xs">
        {entries.map((e) => {
          const notes = extractNotes(e.details);
          return (
            <li key={e.id} className="border-b border-border/60 pb-2 last:border-0 last:pb-0">
              <p className="font-medium">
                {auditActionLabel(e.action, e.details)}
              </p>
              <p className="text-muted-foreground">
                {e.email || "—"} · {formatDateTime(e.createdAt)}
              </p>
              {notes ? (
                <p className="mt-0.5 text-muted-foreground">Catatan: {notes}</p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
