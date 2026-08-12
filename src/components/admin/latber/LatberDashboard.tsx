"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Copy,
  Loader2,
  MessageCircle,
  Plus,
  Printer,
  RefreshCw,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { canEditKyuBaru } from "@/lib/belt";
import { buildLatberInviteUrl } from "@/lib/latber-invite";
import {
  buildLatberNotaTotals,
  formatLatberCurrency,
  formatLatberPeriodLabel,
  formatLatberRank,
  latberDisplayStatusLabel,
  resolveLatberDisplayStatus,
  type LatberMemberRow,
  type LatberPeriodMeta,
  type LatberPeriodOption,
} from "@/lib/latber";
import { countLatberKpis } from "@/lib/latber-data";
import { combineDateAndTimeLocal } from "@/lib/ukt";
import { Time24Fields } from "@/components/admin/Time24Fields";
import { parseApiJson } from "@/lib/api-client";
import { showError, showSuccess } from "@/lib/client-toast";
import { LatberPrintModal } from "@/components/admin/latber/LatberPrintModal";

type LatberDashboardProps = {
  periods: LatberPeriodOption[];
  selectedPeriodId: string | null;
  selectedPeriod: LatberPeriodOption | null;
  periodMeta: LatberPeriodMeta;
  feeAmount: number;
  komisiRanting: number;
  rows: LatberMemberRow[];
  dojos: Array<{ id: string; name: string }>;
  userRoles: string[];
  primaryRole: string;
  canCreatePeriod: boolean;
  isArchiveView?: boolean;
  dbError?: boolean;
};

function StatusBadge({ row }: { row: LatberMemberRow }) {
  const status = resolveLatberDisplayStatus(row);
  const label = latberDisplayStatusLabel(status);
  const className =
    status === "lunas"
      ? "bg-emerald-600 text-white"
      : status === "menunggu_verifikasi" || status === "belum_bayar"
        ? "bg-amber-500/15 text-amber-800"
        : status === "menunggu_terima_ranting" ||
            status === "menunggu_konfirmasi_ranting"
          ? "bg-blue-500/15 text-blue-800"
          : status === "ditolak" || status === "batal"
            ? "bg-red-500/15 text-red-700"
            : "bg-muted text-muted-foreground";
  return <Badge className={className}>{label}</Badge>;
}

export function LatberDashboard(props: LatberDashboardProps) {
  const router = useRouter();
  const [rows, setRows] = useState(props.rows);
  const [localDojo, setLocalDojo] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: "",
    openDate: "",
    openTime: "00:00",
    closeDate: "",
    closeTime: "23:59",
    eventDate: "",
    eventTime: "08:00",
    eventLocation: "",
  });

  const isCabang = canEditKyuBaru(props.userRoles);
  const isDojoAdmin = props.primaryRole === "ADMIN_DOJO";

  const displayRows = useMemo(() => {
    let list = rows;
    if (localDojo) list = list.filter((r) => r.dojoId === localDojo);
    const q = searchQ.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          r.fullName.toLowerCase().includes(q) ||
          String(r.nia ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [rows, localDojo, searchQ]);

  const kpis = useMemo(() => countLatberKpis(rows), [rows]);
  const notaTotals = useMemo(
    () => buildLatberNotaTotals(rows, props.feeAmount, props.komisiRanting),
    [rows, props.feeAmount, props.komisiRanting],
  );

  const refresh = useCallback(() => router.refresh(), [router]);

  async function runAction(
    registrationId: string,
    body: Record<string, unknown>,
    successMsg: string,
  ) {
    setPendingId(registrationId);
    try {
      const res = await fetch(`/api/admin/latber/registrations/${registrationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await parseApiJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error || "Gagal memproses");
      showSuccess(successMsg);
      refresh();
    } catch (e) {
      showError(e instanceof Error ? e.message : "Gagal memproses");
    } finally {
      setPendingId(null);
    }
  }

  async function handleRegister(memberId: string) {
    if (!props.selectedPeriodId) return;
    setPendingId(memberId);
    try {
      const res = await fetch("/api/admin/latber/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: props.selectedPeriodId,
          memberId,
        }),
      });
      const data = await parseApiJson<{
        error?: string;
        registrationId?: string;
        billingStatus?: string;
      }>(res);
      if (!res.ok) throw new Error(data.error || "Gagal mendaftar");
      showSuccess("Anggota didaftarkan — status Belum Bayar");
      refresh();
    } catch (e) {
      showError(e instanceof Error ? e.message : "Gagal mendaftar");
    } finally {
      setPendingId(null);
    }
  }

  async function handleDelete(registrationId: string, force = false) {
    if (!confirm(force ? "Batalkan pendaftaran (termasuk lunas)?" : "Batalkan pendaftaran?")) {
      return;
    }
    setPendingId(registrationId);
    try {
      const qs = force ? "?force=1" : "";
      const res = await fetch(
        `/api/admin/latber/registrations/${registrationId}${qs}`,
        { method: "DELETE" },
      );
      const data = await parseApiJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error || "Gagal membatalkan");
      setRows((prev) => prev.filter((r) => r.registrationId !== registrationId));
      showSuccess("Pendaftaran dibatalkan");
      refresh();
    } catch (e) {
      showError(e instanceof Error ? e.message : "Gagal membatalkan");
    } finally {
      setPendingId(null);
    }
  }

  async function handleCreatePeriod() {
    try {
      const toIso = (date: string, time: string, label: string) => {
        if (!date || !time) return undefined;
        const d = combineDateAndTimeLocal(date, time);
        if (Number.isNaN(d.getTime())) {
          throw new Error(`${label} tidak valid`);
        }
        return d.toISOString();
      };

      const registrationOpenAt = toIso(
        createForm.openDate,
        createForm.openTime,
        "Tanggal buka pendaftaran",
      );
      const registrationCloseAt = toIso(
        createForm.closeDate,
        createForm.closeTime,
        "Batas pendaftaran",
      );
      const eventAt = toIso(
        createForm.eventDate,
        createForm.eventTime,
        "Waktu latihan",
      );

      const res = await fetch("/api/admin/latber/period", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: createForm.title || "Latihan Bersama",
          registrationOpenAt,
          registrationCloseAt,
          eventAt,
          eventLocation: createForm.eventLocation || undefined,
        }),
      });
      const data = await parseApiJson<{
        error?: string;
        event?: { id?: string };
      }>(res);
      if (!res.ok) throw new Error(data.error || "Gagal membuat periode");
      showSuccess("Periode Latihan Bersama dibuat");
      setCreateOpen(false);
      const periodId = data.event?.id;
      if (periodId) {
        router.push(`/admin/latber?period=${periodId}`);
      } else {
        refresh();
      }
    } catch (e) {
      showError(e instanceof Error ? e.message : "Gagal membuat periode");
    }
  }

  function copyInvite() {
    if (!props.selectedPeriodId) return;
    const url = buildLatberInviteUrl(props.selectedPeriodId);
    void navigator.clipboard.writeText(url);
    showSuccess("Link undangan disalin");
  }

  function waInvite() {
    if (!props.selectedPeriodId) return;
    const url = buildLatberInviteUrl(props.selectedPeriodId);
    const title = props.selectedPeriod?.title ?? "Latihan Bersama";
    const text = encodeURIComponent(
      `Undangan ${title} — INKAI Surabaya\nDaftarkan anggota ranting Anda:\n${url}`,
    );
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
  }

  async function handleSuggestRegister() {
    const q = searchQ.trim();
    if (q.length < 2 || !props.selectedPeriodId) return;
    setPendingId("suggest");
    try {
      const qs = new URLSearchParams({ q, periodId: props.selectedPeriodId });
      if (localDojo) qs.set("dojo", localDojo);
      const res = await fetch(`/api/admin/latber/suggest?${qs}`);
      const data = await parseApiJson<{
        results?: Array<{ memberId: string; fullName: string }>;
        error?: string;
      }>(res);
      if (!res.ok) throw new Error(data.error || "Pencarian gagal");
      const first = data.results?.[0];
      if (!first) {
        showError("Anggota tidak ditemukan atau sudah terdaftar");
        return;
      }
      await handleRegister(first.memberId);
    } catch (e) {
      showError(e instanceof Error ? e.message : "Pencarian gagal");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={props.selectedPeriodId ?? "none"}
          onValueChange={(v) => {
            if (v === "none") return;
            const base = props.isArchiveView ? "/admin/latber/arsip" : "/admin/latber";
            router.push(`${base}?period=${v}`);
          }}
        >
          <SelectTrigger className="w-[min(100%,320px)]">
            <SelectValue placeholder="Pilih periode" />
          </SelectTrigger>
          <SelectContent>
            {props.periods.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {formatLatberPeriodLabel(p.title)}
                {p.archived ? " (Arsip)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {props.canCreatePeriod && !props.isArchiveView && (
          <Button type="button" variant="outline" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Buat Periode
          </Button>
        )}

        {props.selectedPeriodId && (
          <>
            <Button type="button" variant="outline" size="sm" onClick={copyInvite}>
              <Copy className="mr-1 h-4 w-4" />
              Salin Undangan
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={waInvite}>
              <MessageCircle className="mr-1 h-4 w-4" />
              WA Undangan
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setPrintOpen(true)}>
              <Printer className="mr-1 h-4 w-4" />
              Cetak Nota
            </Button>
          </>
        )}

        <Button type="button" variant="ghost" size="icon" onClick={refresh} title="Muat ulang">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {props.selectedPeriod && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              Peserta
            </div>
            <p className="mt-1 text-2xl font-semibold">{kpis.total}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">Belum Bayar</p>
            <p className="mt-1 text-2xl font-semibold text-amber-700">{kpis.belumBayar}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">Menunggu Verifikasi</p>
            <p className="mt-1 text-2xl font-semibold">{kpis.menungguVerifikasi}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">Lunas</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-700">{kpis.lunas}</p>
          </div>
        </div>
      )}

      {!props.selectedPeriodId && (
        <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
          {props.canCreatePeriod
            ? "Belum ada periode Latihan Bersama aktif. Klik Buat Periode untuk memulai."
            : "Belum ada periode Latihan Bersama aktif."}
        </div>
      )}

      {props.selectedPeriodId && (
        <>
          <div className="flex flex-wrap gap-2">
            {!isDojoAdmin && (
              <Select value={localDojo || "all"} onValueChange={(v) => setLocalDojo(v === "all" ? "" : v)}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Semua ranting" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua ranting</SelectItem>
                  {props.dojos.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Input
              placeholder="Cari nama atau NIA…"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              className="max-w-xs"
            />
            {searchQ.trim().length >= 2 && (
              <Button type="button" variant="secondary" onClick={handleSuggestRegister}>
                Daftar dari pencarian
              </Button>
            )}
          </div>

          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-10">No</TableHead>
                  <TableHead>NIA</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead>Sabuk</TableHead>
                  {!isDojoAdmin && <TableHead>Ranting</TableHead>}
                  <TableHead>Biaya</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="min-w-[220px]">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                      {props.dbError
                        ? "Gagal memuat data."
                        : "Belum ada peserta. Cari anggota lalu daftar."}
                    </TableCell>
                  </TableRow>
                ) : (
                  displayRows.map((row, i) => {
                    const status = resolveLatberDisplayStatus(row);
                    const busy = pendingId === row.registrationId || pendingId === row.memberId;
                    return (
                      <TableRow key={row.registrationId ?? row.memberId}>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell>{row.nia || "—"}</TableCell>
                        <TableCell className="font-medium">{row.fullName}</TableCell>
                        <TableCell>{formatLatberRank(row)}</TableCell>
                        {!isDojoAdmin && <TableCell>{row.dojoName || "—"}</TableCell>}
                        <TableCell>{formatLatberCurrency(props.feeAmount)}</TableCell>
                        <TableCell>
                          <StatusBadge row={row} />
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {status === "menunggu_terima_ranting" && (
                              <>
                                <Button
                                  size="sm"
                                  disabled={busy}
                                  onClick={() =>
                                    runAction(
                                      row.registrationId!,
                                      { action: "accept_self_registration" },
                                      "Pendaftaran diterima",
                                    )
                                  }
                                >
                                  Terima
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={busy}
                                  onClick={() =>
                                    runAction(
                                      row.registrationId!,
                                      { action: "reject_self_registration" },
                                      "Pendaftaran ditolak",
                                    )
                                  }
                                >
                                  Tolak
                                </Button>
                              </>
                            )}
                            {status === "belum_bayar" && (
                              <Button
                                size="sm"
                                disabled={busy}
                                onClick={() =>
                                  runAction(
                                    row.registrationId!,
                                    { action: "submit_for_verification" },
                                    "Diajukan ke cabang",
                                  )
                                }
                              >
                                Bayar
                              </Button>
                            )}
                            {status === "menunggu_verifikasi" && isCabang && (
                              <Button
                                size="sm"
                                disabled={busy}
                                onClick={() =>
                                  runAction(
                                    row.registrationId!,
                                    { action: "mark_paid" },
                                    "Pembayaran diverifikasi",
                                  )
                                }
                              >
                                Verifikasi
                              </Button>
                            )}
                            {row.registrationId &&
                              status !== "lunas" &&
                              status !== "ditolak" &&
                              status !== "batal" && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={busy}
                                  onClick={() => handleDelete(row.registrationId!, false)}
                                >
                                  Batal
                                </Button>
                              )}
                            {row.registrationId &&
                              (status === "lunas" || status === "menunggu_verifikasi") &&
                              (isCabang || isDojoAdmin) && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={busy}
                                  onClick={() => handleDelete(row.registrationId!, true)}
                                >
                                  Hapus
                                </Button>
                              )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <p className="text-sm text-muted-foreground">
            Biaya {formatLatberCurrency(props.feeAmount)}/peserta · Komisi ranting{" "}
            {formatLatberCurrency(props.komisiRanting)} · Setor cabang{" "}
            {formatLatberCurrency(props.feeAmount - props.komisiRanting)}/peserta lunas
          </p>
        </>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Buat Periode Latihan Bersama</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="latber-title">Nama periode</Label>
              <Input
                id="latber-title"
                placeholder="Latihan Bersama Maret 2026"
                value={createForm.title}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, title: e.target.value }))
                }
              />
            </div>
            <Time24Fields
              dateId="latber-open-date"
              dateLabel="Tanggal buka pendaftaran"
              date={createForm.openDate}
              time={createForm.openTime}
              onDateChange={(openDate) => setCreateForm((f) => ({ ...f, openDate }))}
              onTimeChange={(openTime) => setCreateForm((f) => ({ ...f, openTime }))}
            />
            <Time24Fields
              dateId="latber-close-date"
              dateLabel="Tanggal batas pendaftaran"
              date={createForm.closeDate}
              time={createForm.closeTime}
              onDateChange={(closeDate) => setCreateForm((f) => ({ ...f, closeDate }))}
              onTimeChange={(closeTime) => setCreateForm((f) => ({ ...f, closeTime }))}
            />
            <Time24Fields
              dateId="latber-event-date"
              dateLabel="Tanggal latihan"
              date={createForm.eventDate}
              time={createForm.eventTime}
              onDateChange={(eventDate) => setCreateForm((f) => ({ ...f, eventDate }))}
              onTimeChange={(eventTime) => setCreateForm((f) => ({ ...f, eventTime }))}
            />
            <div>
              <Label htmlFor="latber-loc">Lokasi</Label>
              <Input
                id="latber-loc"
                placeholder="Alamat / venue"
                value={createForm.eventLocation}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, eventLocation: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Batal
            </Button>
            <Button type="button" onClick={handleCreatePeriod}>
              <Calendar className="mr-2 h-4 w-4" />
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {printOpen && props.selectedPeriod && (
        <LatberPrintModal
          open={printOpen}
          onOpenChange={setPrintOpen}
          periodTitle={props.selectedPeriod.title}
          rows={rows.filter((r) => resolveLatberDisplayStatus(r) === "lunas")}
          feeAmount={props.feeAmount}
          komisiRanting={props.komisiRanting}
          totals={notaTotals}
        />
      )}
    </div>
  );
}
