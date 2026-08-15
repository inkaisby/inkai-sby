"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Camera,
  Check,
  Copy,
  Loader2,
  Search,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import RegisterForm from "@/components/auth/RegisterForm";
import { formatMemberName, formatRankLabel } from "@/lib/belt";
import {
  formatLatberCurrency,
  formatLatberPeriodLabel,
  LATBER_PAYMENT,
  type LatberPaymentInfo,
} from "@/lib/latber";
import { parseMemberCardScanPayload } from "@/lib/latber-card-scan";
import { showError, showSuccess } from "@/lib/client-toast";
import { cn } from "@/lib/utils";

type PeriodPayload = {
  periodId: string | null;
  title: string | null;
  registrationOpen: boolean;
  registrationOpenAt: string | null;
  registrationCloseAt: string | null;
  eventAt: string | null;
  eventLocation: string | null;
  feeAmount: number;
  paymentEnabled: boolean;
  payment?: LatberPaymentInfo;
};

type Registrant = {
  memberId: string;
  registrationId: string;
  nia: string | null;
  fullName: string;
  dojoName: string;
  currentRank: string | null;
  amount: number;
  uniqueTail: number | null;
  statusLabel: string;
  displayStatus: string;
};

type Suggestion = {
  id: string;
  fullName: string;
  nia: string | null;
  dojoName?: string;
  currentRank?: string;
  registered?: boolean;
  canRegister?: boolean;
  status?: string;
};

const WA_ADMIN = "6281331053100";

function buildBatalWaUrl(nama: string, ranting: string) {
  const text = `batal ikut latber ${nama}, ${ranting}`;
  return `https://wa.me/${WA_ADMIN}?text=${encodeURIComponent(text)}`;
}

async function copyText(value: string) {
  await navigator.clipboard.writeText(value);
}

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
};

declare global {
  interface Window {
    BarcodeDetector?: new (opts?: { formats?: string[] }) => BarcodeDetectorLike;
  }
}

export function LatberWalkInClient({
  initialPeriod,
}: {
  initialPeriod?: string | null;
}) {
  const [period, setPeriod] = useState<PeriodPayload | null>(null);
  const [registrants, setRegistrants] = useState<Registrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [pendingMember, setPendingMember] = useState<Suggestion | null>(null);
  const [registering, setRegistering] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [payRow, setPayRow] = useState<Registrant | null>(null);
  const [confirmingPay, setConfirmingPay] = useState(false);
  const [copiedField, setCopiedField] = useState<"account" | "amount" | null>(
    null,
  );

  const searchWrapRef = useRef<HTMLDivElement>(null);
  const suggestDebounce = useRef<ReturnType<typeof setTimeout>>(undefined);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanLoopRef = useRef<number | null>(null);

  const periodId = period?.periodId ?? null;
  const registrationOpen = Boolean(period?.registrationOpen);
  const payment: LatberPaymentInfo = period?.payment ?? {
    bankName: LATBER_PAYMENT.bankName,
    bankAccountNumber: LATBER_PAYMENT.bankAccountNumber,
    bankAccountName: LATBER_PAYMENT.bankAccountName,
    paymentInstructions: LATBER_PAYMENT.paymentInstructions,
    qrisImageUrl: LATBER_PAYMENT.qrisImageUrl,
    qrisTrialNote: LATBER_PAYMENT.qrisTrialNote,
    qrisExpiresAtLabel: LATBER_PAYMENT.qrisExpiresAtLabel,
  };

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const qs = initialPeriod
        ? `?period=${encodeURIComponent(initialPeriod)}`
        : "";
      const [pRes, rRes] = await Promise.all([
        fetch(`/api/public/latber/period${qs}`),
        fetch(`/api/public/latber/registrants${qs}`),
      ]);
      const pData = (await pRes.json()) as PeriodPayload;
      const rData = (await rRes.json()) as { registrants?: Registrant[] };
      setPeriod(pData);
      setRegistrants(rData.registrants ?? []);
    } catch {
      showError("Gagal memuat data Latihan Bersama");
    } finally {
      setLoading(false);
    }
  }, [initialPeriod]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (
        searchWrapRef.current &&
        !searchWrapRef.current.contains(e.target as Node)
      ) {
        setSuggestOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const fetchSuggestions = useCallback(
    (q: string) => {
      clearTimeout(suggestDebounce.current);
      const needle = parseMemberCardScanPayload(q);
      if (needle.trim().length < 2) {
        setSuggestions([]);
        return;
      }
      suggestDebounce.current = setTimeout(() => {
        setSuggestLoading(true);
        const params = new URLSearchParams({ q: needle });
        if (periodId) params.set("period", periodId);
        void fetch(`/api/public/latber/suggest?${params}`)
          .then(async (res) => {
            const data = (await res.json()) as { suggestions?: Suggestion[] };
            setSuggestions(data.suggestions ?? []);
            setSuggestOpen(true);
          })
          .catch(() => setSuggestions([]))
          .finally(() => setSuggestLoading(false));
      }, 220);
    },
    [periodId],
  );

  const filteredRows = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    if (q.length < 2) return registrants;
    return registrants.filter(
      (r) =>
        r.fullName.toLowerCase().includes(q) ||
        (r.nia?.toLowerCase().includes(q) ?? false) ||
        r.dojoName.toLowerCase().includes(q),
    );
  }, [registrants, searchQ]);

  const kpis = useMemo(() => {
    let belumBayar = 0;
    let menungguVerifikasi = 0;
    let lunas = 0;
    for (const r of registrants) {
      if (r.displayStatus === "belum_bayar") belumBayar += 1;
      else if (r.displayStatus === "menunggu_verifikasi") menungguVerifikasi += 1;
      else if (r.displayStatus === "lunas") lunas += 1;
    }
    return {
      total: registrants.length,
      belumBayar,
      menungguVerifikasi,
      lunas,
    };
  }, [registrants]);

  const rantingKpis = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of registrants) {
      const name = r.dojoName?.trim() || "—";
      map.set(name, (map.get(name) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "id"));
  }, [registrants]);

  const chartSegments = useMemo(() => {
    const total =
      kpis.belumBayar + kpis.menungguVerifikasi + kpis.lunas || 1;
    return [
      {
        key: "belum",
        label: "Belum Bayar",
        count: kpis.belumBayar,
        pct: (kpis.belumBayar / total) * 100,
        className: "bg-amber-500",
      },
      {
        key: "tunggu",
        label: "Menunggu Verifikasi",
        count: kpis.menungguVerifikasi,
        pct: (kpis.menungguVerifikasi / total) * 100,
        className: "bg-sky-500",
      },
      {
        key: "lunas",
        label: "Lunas",
        count: kpis.lunas,
        pct: (kpis.lunas / total) * 100,
        className: "bg-emerald-500",
      },
    ];
  }, [kpis]);

  async function handleRegister(memberId: string) {
    if (!periodId || !registrationOpen) return;
    setRegistering(true);
    try {
      const res = await fetch("/api/public/latber/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: periodId, memberId }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Gagal mendaftarkan");
      }
      showSuccess("Berhasil didaftarkan Latihan Bersama");
      setPendingMember(null);
      setHighlightId(memberId);
      await reload();
      setTimeout(() => {
        document
          .getElementById(`latber-row-${memberId}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 200);
    } catch (e) {
      showError(e instanceof Error ? e.message : "Gagal mendaftarkan");
    } finally {
      setRegistering(false);
    }
  }

  async function handleConfirmPayment() {
    if (!periodId || !payRow) return;
    setConfirmingPay(true);
    try {
      const res = await fetch("/api/public/latber/confirm-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: periodId,
          registrationId: payRow.registrationId,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Gagal mengonfirmasi pembayaran");
      }
      showSuccess("Pembayaran dikonfirmasi — menunggu verifikasi bendahara");
      setPayRow(null);
      await reload();
    } catch (e) {
      showError(
        e instanceof Error ? e.message : "Gagal mengonfirmasi pembayaran",
      );
    } finally {
      setConfirmingPay(false);
    }
  }

  async function handleCopy(field: "account" | "amount", value: string) {
    try {
      await copyText(value);
      setCopiedField(field);
      showSuccess(field === "account" ? "No. rekening disalin" : "Nominal disalin");
      setTimeout(() => setCopiedField(null), 1500);
    } catch {
      showError("Gagal menyalin");
    }
  }

  function pickSuggestion(s: Suggestion) {
    setSearchQ(s.fullName);
    setSuggestOpen(false);
    if (s.registered) {
      setHighlightId(s.id);
      setTimeout(() => {
        document
          .getElementById(`latber-row-${s.id}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
      showSuccess("Anggota sudah terdaftar — lihat baris di tabel");
      return;
    }
    if (s.canRegister === false) {
      showError("Anggota tidak aktif — tidak dapat didaftarkan");
      return;
    }
    setPendingMember(s);
  }

  function stopScan() {
    if (scanLoopRef.current != null) {
      cancelAnimationFrame(scanLoopRef.current);
      scanLoopRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanOpen(false);
    setScanError(null);
  }

  async function startScan() {
    setScanError(null);
    setScanOpen(true);
    try {
      if (!window.BarcodeDetector) {
        setScanError(
          "Kamera barcode tidak didukung di browser ini. Gunakan Chrome/Android atau ketik NIA.",
        );
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();

      const detector = new window.BarcodeDetector({
        formats: ["qr_code"],
      });

      const tick = async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) {
          scanLoopRef.current = requestAnimationFrame(() => void tick());
          return;
        }
        try {
          const codes = await detector.detect(videoRef.current);
          const raw = codes[0]?.rawValue;
          if (raw) {
            const parsed = parseMemberCardScanPayload(raw);
            stopScan();
            setSearchQ(parsed);
            fetchSuggestions(parsed);
            const params = new URLSearchParams({ q: parsed });
            if (periodId) params.set("period", periodId);
            const res = await fetch(`/api/public/latber/suggest?${params}`);
            const data = (await res.json()) as { suggestions?: Suggestion[] };
            const first = data.suggestions?.[0];
            if (first) pickSuggestion(first);
            else {
              setShowAddModal(true);
              showError("Kartu tidak dikenali — isi form Tambah Anggota");
            }
            return;
          }
        } catch {
          /* keep scanning */
        }
        scanLoopRef.current = requestAnimationFrame(() => void tick());
      };
      scanLoopRef.current = requestAnimationFrame(() => void tick());
    } catch {
      setScanError(
        "Tidak bisa membuka kamera. Izinkan akses kamera atau ketik NIA.",
      );
    }
  }

  useEffect(() => () => stopScan(), []);

  const titleLabel = period?.title
    ? formatLatberPeriodLabel(period.title)
    : "Latihan Bersama";

  const hasBank = Boolean(
    payment.bankName.trim() &&
      payment.bankAccountNumber.trim() &&
      payment.bankAccountName.trim(),
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <header className="space-y-2">
        <p className="text-sm font-medium text-inkai-red">Latihan Bersama</p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {loading ? "Memuat…" : titleLabel}
        </h1>
        {period?.eventLocation || period?.eventAt ? (
          <p className="text-sm text-muted-foreground">
            {[
              period.eventLocation,
              period.eventAt
                ? new Date(period.eventAt).toLocaleString("id-ID")
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        ) : null}
        {!loading && !period?.periodId ? (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
            Belum ada periode Latihan Bersama aktif.
          </p>
        ) : null}
        {!loading && period?.periodId && !registrationOpen ? (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
            Pendaftaran ditutup. Daftar peserta masih dapat dilihat.
          </p>
        ) : null}
      </header>

      <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground">Info anggota</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Login di portal dengan <strong>NIA</strong> atau email. Setelah masuk
          dashboard keanggotaan, tersedia kartu anggota (NIA + QR) dan fitur{" "}
          <strong>Pesan</strong> (pesan interaktif ke ranting/PIC).
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/login">Login</Link>
          </Button>
          <Button asChild size="sm" className="bg-inkai-red hover:bg-inkai-red/90">
            <Link href="/login?tab=daftar">Daftar</Link>
          </Button>
        </div>
      </section>

      {period?.periodId ? (
        <section className="space-y-3">
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
              <p className="mt-1 text-2xl font-semibold text-amber-700">
                {kpis.belumBayar}
              </p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-sm text-muted-foreground">Menunggu Verifikasi</p>
              <p className="mt-1 text-2xl font-semibold">
                {kpis.menungguVerifikasi}
              </p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-sm text-muted-foreground">Lunas</p>
              <p className="mt-1 text-2xl font-semibold text-emerald-700">
                {kpis.lunas}
              </p>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm font-medium text-foreground">Status pembayaran</p>
            {kpis.total === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Belum ada peserta.
              </p>
            ) : (
              <>
                <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-muted">
                  {chartSegments.map((seg) =>
                    seg.count > 0 ? (
                      <div
                        key={seg.key}
                        className={cn("h-full transition-all", seg.className)}
                        style={{ width: `${seg.pct}%` }}
                        title={`${seg.label}: ${seg.count}`}
                      />
                    ) : null,
                  )}
                </div>
                <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {chartSegments.map((seg) => (
                    <li key={seg.key} className="flex items-center gap-1.5">
                      <span
                        className={cn("inline-block h-2.5 w-2.5 rounded-sm", seg.className)}
                      />
                      {seg.label} ({seg.count})
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          {rantingKpis.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Peserta per ranting</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {rantingKpis.map((r) => (
                  <div key={r.name} className="rounded-xl border bg-card p-4">
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {r.name}
                    </p>
                    <p className="mt-1 text-2xl font-semibold">{r.count}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="space-y-2">
        <div ref={searchWrapRef} className="relative flex flex-wrap gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQ}
              disabled={!periodId}
              onChange={(e) => {
                const v = e.target.value;
                setSearchQ(v);
                fetchSuggestions(v);
                setSuggestOpen(v.trim().length >= 2);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const parsed = parseMemberCardScanPayload(searchQ);
                  if (parsed !== searchQ) {
                    setSearchQ(parsed);
                    fetchSuggestions(parsed);
                  }
                }
              }}
              placeholder="Cari nama atau NIA… (atau scan kartu)"
              className="h-10 pr-8 pl-9"
              autoComplete="off"
            />
            {searchQ ? (
              <button
                type="button"
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setSearchQ("");
                  setSuggestions([]);
                }}
                aria-label="Hapus pencarian"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
            {suggestOpen && (suggestions.length > 0 || suggestLoading) ? (
              <ul className="absolute z-40 mt-1 max-h-64 w-full overflow-auto rounded-md border border-border bg-popover py-1 text-sm shadow-md">
                {suggestLoading && suggestions.length === 0 ? (
                  <li className="px-3 py-2 text-muted-foreground">Mencari…</li>
                ) : null}
                {suggestions.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-muted"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pickSuggestion(s)}
                    >
                      <span className="font-medium">
                        {formatMemberName(s.fullName)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {[
                          s.nia,
                          formatRankLabel(s.currentRank || "") || s.currentRank,
                          s.dojoName,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                        {" · "}
                        {s.registered ? "Sudah daftar" : "Belum daftar"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-10"
            disabled={!periodId}
            onClick={() => void startScan()}
          >
            <Camera className="mr-1 h-4 w-4" />
            Scan QR
          </Button>
          {registrationOpen ? (
            <Button
              type="button"
              variant="outline"
              className="h-10"
              onClick={() => setShowAddModal(true)}
            >
              <UserPlus className="mr-1 h-4 w-4" />
              Tambah Anggota
            </Button>
          ) : null}
        </div>
        {searchQ.trim().length >= 2 &&
        !suggestLoading &&
        suggestions.length === 0 &&
        registrationOpen ? (
          <p className="text-xs text-muted-foreground">
            Nama tidak ditemukan —{" "}
            <button
              type="button"
              className="font-medium text-inkai-red underline"
              onClick={() => setShowAddModal(true)}
            >
              Tambah Anggota
            </button>
          </p>
        ) : null}
        {registrationOpen ? (
          <p className="text-xs text-muted-foreground">
            Pilih saran lalu konfirmasi <b>Daftar</b>. Scan QR kartu tidak
            mendaftarkan otomatis.
          </p>
        ) : null}
      </div>

      {pendingMember && registrationOpen ? (
        <div className="rounded-xl border border-inkai-red/30 bg-inkai-red/5 p-4">
          <p className="text-sm font-medium">Konfirmasi daftar</p>
          <p className="mt-1 text-sm">
            {formatMemberName(pendingMember.fullName)}
            {pendingMember.nia ? ` · ${pendingMember.nia}` : ""}
            {pendingMember.dojoName ? ` · ${pendingMember.dojoName}` : ""}
            {pendingMember.currentRank
              ? ` · ${formatRankLabel(pendingMember.currentRank) || pendingMember.currentRank}`
              : ""}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              className="bg-inkai-red hover:bg-inkai-red/90"
              disabled={registering}
              onClick={() => void handleRegister(pendingMember.id)}
            >
              {registering ? (
                <>
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  Mendaftarkan…
                </>
              ) : (
                "Daftar"
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={registering}
              onClick={() => setPendingMember(null)}
            >
              Batal
            </Button>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-10">No</TableHead>
              <TableHead>NIA</TableHead>
              <TableHead>Nama</TableHead>
              <TableHead>Ranting</TableHead>
              <TableHead>Sabuk</TableHead>
              <TableHead>Biaya</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="min-w-[200px]">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-10 text-center text-muted-foreground"
                >
                  Memuat peserta…
                </TableCell>
              </TableRow>
            ) : filteredRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-10 text-center text-muted-foreground"
                >
                  Belum ada peserta. Cari nama atau scan kartu lalu daftar.
                </TableCell>
              </TableRow>
            ) : (
              filteredRows.map((row, i) => {
                const paid = row.displayStatus === "lunas";
                const waiting = row.displayStatus === "menunggu_verifikasi";
                const unpaid = row.displayStatus === "belum_bayar";
                return (
                  <TableRow
                    key={row.registrationId}
                    id={`latber-row-${row.memberId}`}
                    className={cn(
                      highlightId === row.memberId && "bg-inkai-red/5",
                    )}
                  >
                    <TableCell>{i + 1}</TableCell>
                    <TableCell>{row.nia || "—"}</TableCell>
                    <TableCell className="font-medium">
                      {formatMemberName(row.fullName)}
                    </TableCell>
                    <TableCell>{row.dojoName}</TableCell>
                    <TableCell>{row.currentRank || "—"}</TableCell>
                    <TableCell>{formatLatberCurrency(row.amount)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{row.statusLabel}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {unpaid ? (
                          <Button
                            size="sm"
                            className="bg-inkai-red hover:bg-inkai-red/90"
                            onClick={() => setPayRow(row)}
                          >
                            Bayar
                          </Button>
                        ) : null}
                        {waiting ? (
                          <span className="inline-flex items-center rounded-md border border-border bg-muted/50 px-2 py-1 text-xs text-muted-foreground">
                            Menunggu verifikasi
                          </span>
                        ) : null}
                        {!paid ? (
                          <Button size="sm" variant="outline" asChild>
                            <a
                              href={buildBatalWaUrl(
                                formatMemberName(row.fullName),
                                row.dojoName,
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Batal
                            </a>
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tambah Anggota Baru</DialogTitle>
            <DialogDescription>
              Form sama dengan halaman Daftar. Setelah berhasil, anggota
              didaftarkan ke Latihan Bersama. Akun menunggu verifikasi admin
              untuk login.
            </DialogDescription>
          </DialogHeader>
          <RegisterForm
            submitLabel="Simpan & Daftar Latber"
            onSuccess={async ({ memberId }) => {
              setShowAddModal(false);
              if (memberId && periodId && registrationOpen) {
                await handleRegister(memberId);
              } else if (!memberId) {
                showError(
                  "Anggota dibuat, tetapi ID belum tersedia. Cari nama lalu daftar manual.",
                );
                await reload();
              }
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(payRow)}
        onOpenChange={(o) => {
          if (!o) setPayRow(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Bayar Latihan Bersama</DialogTitle>
            <DialogDescription>
              {payRow
                ? `${formatMemberName(payRow.fullName)}${payRow.nia ? ` · ${payRow.nia}` : ""}`
                : "Transfer sesuai nominal unik."}
            </DialogDescription>
          </DialogHeader>

          {payRow ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="overflow-hidden rounded-lg border bg-white">
                  <Image
                    src={payment.qrisImageUrl}
                    alt="QRIS Latber percobaan"
                    width={720}
                    height={960}
                    className="mx-auto h-auto w-full max-w-sm object-contain"
                    priority
                  />
                </div>
                <p className="text-center text-xs font-medium text-amber-800 dark:text-amber-200">
                  {payment.qrisTrialNote}
                </p>
                <p className="text-center text-xs text-muted-foreground">
                  Berlaku hingga {payment.qrisExpiresAtLabel}
                </p>
              </div>

              {hasBank ? (
                <div className="space-y-2 rounded-lg border p-3 text-sm">
                  <p>
                    <span className="text-muted-foreground">Bank</span>
                    <br />
                    <span className="font-medium">{payment.bankName}</span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Atas nama</span>
                    <br />
                    <span className="font-medium">{payment.bankAccountName}</span>
                  </p>
                  <div className="flex items-end justify-between gap-2">
                    <div>
                      <span className="text-muted-foreground">No. rekening</span>
                      <p className="font-mono text-base font-semibold tracking-wide">
                        {payment.bankAccountNumber}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void handleCopy("account", payment.bankAccountNumber)
                      }
                    >
                      {copiedField === "account" ? (
                        <Check className="mr-1 h-3.5 w-3.5" />
                      ) : (
                        <Copy className="mr-1 h-3.5 w-3.5" />
                      )}
                      Salin
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
                  Rekening belum dikonfigurasi — hubungi panitia. Nominal tetap
                  ditampilkan di bawah.
                </p>
              )}

              <div className="flex items-end justify-between gap-2 rounded-lg border p-3">
                <div>
                  <span className="text-sm text-muted-foreground">Nominal</span>
                  <p className="text-xl font-semibold text-inkai-red">
                    {formatLatberCurrency(payRow.amount)}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void handleCopy("amount", String(Math.round(payRow.amount)))
                  }
                >
                  {copiedField === "amount" ? (
                    <Check className="mr-1 h-3.5 w-3.5" />
                  ) : (
                    <Copy className="mr-1 h-3.5 w-3.5" />
                  )}
                  Salin
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                {payment.paymentInstructions ||
                  "Transfer nominal unik sesuai baris. Cantumkan NIA atau nama di berita transfer."}
                {payRow.nia ? ` Berita: ${payRow.nia}.` : ""}
              </p>
            </div>
          ) : null}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={confirmingPay}
              onClick={() => setPayRow(null)}
            >
              Tutup
            </Button>
            <Button
              type="button"
              className="bg-inkai-red hover:bg-inkai-red/90"
              disabled={confirmingPay || !payRow}
              onClick={() => void handleConfirmPayment()}
            >
              {confirmingPay ? (
                <>
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  Mengirim…
                </>
              ) : (
                "Sudah bayar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={scanOpen}
        onOpenChange={(o) => {
          if (!o) stopScan();
          else setScanOpen(true);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Scan QR kartu anggota</DialogTitle>
            <DialogDescription>
              Arahkan kamera ke QR pada kartu dashboard anggota.
            </DialogDescription>
          </DialogHeader>
          {scanError ? (
            <p className="text-sm text-destructive">{scanError}</p>
          ) : (
            <video
              ref={videoRef}
              className="aspect-square w-full rounded-lg bg-black object-cover"
              muted
              playsInline
            />
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={stopScan}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
