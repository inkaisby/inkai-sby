"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Camera,
  Loader2,
  Search,
  UserPlus,
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
import { formatLatberCurrency, formatLatberPeriodLabel } from "@/lib/latber";
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
  paymentEnabled: false;
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

  const searchWrapRef = useRef<HTMLDivElement>(null);
  const suggestDebounce = useRef<ReturnType<typeof setTimeout>>(undefined);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanLoopRef = useRef<number | null>(null);

  const periodId = period?.periodId ?? null;
  const registrationOpen = Boolean(period?.registrationOpen);

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

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <header className="space-y-2">
        <p className="text-sm font-medium text-inkai-red">Latihan Bersama</p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {loading ? "Memuat…" : titleLabel}
        </h1>
        {period?.eventLocation || period?.eventAt ? (
          <p className="text-sm text-muted-foreground">
            {[period.eventLocation, period.eventAt ? new Date(period.eventAt).toLocaleString("id-ID") : null]
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
                        {[s.nia, formatRankLabel(s.currentRank || "") || s.currentRank, s.dojoName]
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

      <div className="rounded-lg border border-dashed border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        Pembayaran QRIS (Midtrans) sedang diaktifkan — daftar tetap bisa. Tombol
        Bayar: <em>Pembayaran QRIS segera aktif</em>.
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
                <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                  Memuat peserta…
                </TableCell>
              </TableRow>
            ) : filteredRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                  Belum ada peserta. Cari nama atau scan kartu lalu daftar.
                </TableCell>
              </TableRow>
            ) : (
              filteredRows.map((row, i) => {
                const paid = row.displayStatus === "lunas";
                const waiting = row.displayStatus === "menunggu_verifikasi";
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
                        {!paid ? (
                          <Button size="sm" variant="outline" disabled title="Pembayaran QRIS segera aktif">
                            Pembayaran QRIS segera aktif
                          </Button>
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
                        {waiting ? null : null}
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
