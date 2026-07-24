"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Award, ChevronRight, Loader2, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRankLabel } from "@/lib/belt";
import {
  formatUktRegistrationDeadline,
  type UktDisplayStatus,
  type UktRegistrationBlocker,
} from "@/lib/ukt";
import { showError, showSuccess } from "@/lib/client-toast";

type UktStatusPayload = {
  period?: {
    id?: string;
    title?: string;
    semester?: string;
    year?: number;
  } | null;
  registered?: boolean;
  statusLabel?: string;
  displayStatus?: UktDisplayStatus;
  kyuLama?: string | null;
  kyuBaru?: string | null;
  examAt?: string | null;
  examLocation?: string | null;
  canSelfRegister?: boolean;
  blockers?: UktRegistrationBlocker[];
  memberPaymentConfirmedAt?: string | null;
};

const STATUS_CLASS: Partial<Record<UktDisplayStatus, string>> = {
  belum_daftar: "bg-muted text-muted-foreground",
  belum_bayar: "bg-amber-500/15 text-amber-700",
  menunggu_terima_ranting: "bg-amber-500/15 text-amber-700",
  menunggu_konfirmasi_ranting: "bg-amber-500/15 text-amber-800",
  menunggu_verifikasi: "bg-amber-500/15 text-amber-700",
  menunggu_ujian: "bg-blue-500/15 text-blue-700",
  lulus: "bg-emerald-500/15 text-emerald-700",
  selesai: "bg-emerald-600 text-white",
  gagal: "bg-red-500/15 text-red-700",
  mengulang: "bg-orange-500/15 text-orange-700",
  ditolak: "bg-red-500/15 text-red-700",
};

const BLOCKER_COPY: Record<
  UktRegistrationBlocker,
  { title: string; body: string; cta: string; href: string }
> = {
  PERIODE_TUTUP: {
    title: "Pendaftaran Ditutup",
    body: "Batas pendaftaran UKT periode ini sudah lewat.",
    cta: "Tutup",
    href: "#",
  },
  PERIODE_BELUM_BUKA: {
    title: "Pendaftaran Belum Dibuka",
    body: "Periode pendaftaran UKT belum dimulai.",
    cta: "Tutup",
    href: "#",
  },
  IURAN_TUNGGAKAN: {
    title: "Iuran Belum Lunas",
    body: "Lunasi iuran bulanan, atau minta ketua ranting mengaktifkan Pengecualian iuran.",
    cta: "Lihat Iuran",
    href: "/dashboard/iuran",
  },
  DOKUMEN_KURANG: {
    title: "Dokumen Belum Lengkap",
    body: "Unggah Akte Kelahiran dan BPJS sebelum mendaftar UKT.",
    cta: "Lengkapi Dokumen",
    href: "/dashboard/dokumen",
  },
  ABSENSI_KURANG: {
    title: "Absensi Belum Memadai",
    body: "Kehadiran semester belum memenuhi syarat minimum UKT. Tingkatkan absensi latihan.",
    cta: "Lihat Absensi",
    href: "/dashboard/absensi",
  },
};

function nextStepHint(
  status?: UktDisplayStatus,
): { text: string; href: string; label: string } | null {
  switch (status) {
    case "belum_daftar":
      return {
        text: "Hubungi ketua ranting untuk pendaftaran UKT periode ini.",
        href: "/dashboard/prestasi?tab=Sabuk",
        label: "Info sabuk & UKT",
      };
    case "menunggu_terima_ranting":
      return {
        text: "Bayar biaya UKT ke ketua ranting Anda (nominal dikonfirmasi ranting), lalu konfirmasi di sini.",
        href: "/dashboard/notifikasi",
        label: "Notifikasi",
      };
    case "menunggu_konfirmasi_ranting":
      return {
        text: "Menunggu ketua ranting menerima pendaftaran dan pembayaran Anda.",
        href: "/dashboard/notifikasi",
        label: "Notifikasi",
      };
    case "belum_bayar":
      return {
        text: "Koordinasikan pembayaran UKT dengan ketua ranting (nota).",
        href: "/dashboard/iuran",
        label: "Lihat tagihan",
      };
    case "menunggu_verifikasi":
      return {
        text: "Ranting sudah meneruskan ke cabang. Menunggu verifikasi pembayaran.",
        href: "/dashboard/notifikasi",
        label: "Notifikasi",
      };
    case "menunggu_ujian":
      return {
        text: "Pembayaran lunas — persiapkan diri untuk ujian kenaikan tingkat.",
        href: "/dashboard/prestasi?tab=Sabuk",
        label: "Status UKT",
      };
    case "lulus":
    case "selesai":
      return {
        text: "Selamat! Sabuk resmi akan/pernah diperbarui setelah verifikasi cabang.",
        href: "/dashboard/prestasi?tab=Sabuk",
        label: "Riwayat sabuk",
      };
    case "gagal":
    case "mengulang":
      return {
        text: "Koordinasikan rencana mengulang dengan pengurus ranting.",
        href: "/dashboard/prestasi?tab=Sabuk",
        label: "Detail UKT",
      };
    case "ditolak":
      return {
        text: "Pengajuan ditolak ranting. Anda dapat mendaftar ulang setelah syarat terpenuhi.",
        href: "/dashboard/prestasi?tab=Sabuk",
        label: "Info UKT",
      };
    default:
      return null;
  }
}

type Props = {
  compact?: boolean;
  initialData?: UktStatusPayload | null;
};

export function UktStatusCard({ compact = false, initialData }: Props) {
  const router = useRouter();
  const [data, setData] = useState<UktStatusPayload | null>(
    initialData ?? null,
  );
  const [loading, setLoading] = useState(initialData === undefined);
  const [actionBusy, setActionBusy] = useState(false);
  const [gateBlockers, setGateBlockers] = useState<UktRegistrationBlocker[] | null>(
    null,
  );

  // Sync dari RSC/Suspense tanpa refetch client ganda
  useEffect(() => {
    if (initialData !== undefined) {
      setData(initialData);
      setLoading(false);
    }
  }, [initialData]);

  // Hanya fetch bila dipasang tanpa SSR payload
  useEffect(() => {
    if (initialData !== undefined) return;
    let cancelled = false;
    fetch("/api/member/ukt-status")
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [initialData]);

  async function handleRegister() {
    if (!data?.period?.id || actionBusy) return;
    setActionBusy(true);
    try {
      const res = await fetch("/api/member/ukt/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: data.period.id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (Array.isArray(json.blockers) && json.blockers.length > 0) {
          setGateBlockers(json.blockers as UktRegistrationBlocker[]);
          return;
        }
        showError(json.error || "Gagal mendaftar UKT");
        return;
      }
      // Optimistic UI — tanpa menunggu refetch ganda
      const nextStatus =
        (json.displayStatus as UktDisplayStatus) || "menunggu_terima_ranting";
      setData((prev) =>
        prev
          ? {
              ...prev,
              registered: true,
              displayStatus: nextStatus,
              statusLabel:
                nextStatus === "belum_bayar"
                  ? "Belum Bayar"
                  : "Menunggu Terima Ranting",
              canSelfRegister: false,
              blockers: [],
            }
          : prev,
      );
      showSuccess(
        json.alreadyRegistered
          ? "Anda sudah terdaftar pada periode ini"
          : "Pengajuan UKT terkirim",
      );
      router.refresh();
    } finally {
      setActionBusy(false);
    }
  }

  async function handleConfirmPayment() {
    if (!data?.period?.id || actionBusy) return;
    setActionBusy(true);
    try {
      const res = await fetch("/api/member/ukt/confirm-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: data.period.id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        showError(json.error || "Gagal konfirmasi pembayaran");
        return;
      }
      setData((prev) =>
        prev
          ? {
              ...prev,
              displayStatus: "menunggu_konfirmasi_ranting",
              statusLabel: "Menunggu Konfirmasi Ranting",
              memberPaymentConfirmedAt: new Date().toISOString(),
            }
          : prev,
      );
      showSuccess("Konfirmasi terkirim — menunggu ketua ranting");
      router.refresh();
    } finally {
      setActionBusy(false);
    }
  }

  if (loading) {
    return (
      <div
        className={`animate-pulse rounded-2xl border border-border/60 bg-card p-4 ${compact ? "" : "mb-6"}`}
      >
        <div className="h-4 w-32 rounded bg-muted" />
        <div className="mt-3 h-6 w-48 rounded bg-muted" />
      </div>
    );
  }

  if (!data?.period) return null;

  const statusClass =
    STATUS_CLASS[data.displayStatus ?? "belum_daftar"] ??
    "bg-muted text-muted-foreground";
  const hint = nextStepHint(data.displayStatus);
  const showRegister =
    data.displayStatus === "belum_daftar" || data.displayStatus === "ditolak";
  const showConfirmPay = data.displayStatus === "menunggu_terima_ranting";

  return (
    <>
      <div
        className={`rounded-2xl border border-inkai-red/20 bg-gradient-to-br from-inkai-red/5 to-card p-4 ${compact ? "" : "mb-6"}`}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Award className="h-4 w-4 text-inkai-red" />
            Status UKT
          </div>
          <Badge className={statusClass}>{data.statusLabel ?? "—"}</Badge>
        </div>
        <p className="font-bold">{data.period.title}</p>
        {data.registered ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Sabuk saat ini: {formatRankLabel(data.kyuLama) || "—"}
            {data.kyuBaru ? ` → Target: ${formatRankLabel(data.kyuBaru)}` : ""}
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">
            Belum terdaftar pada periode aktif.
          </p>
        )}
        {data.examAt && (
          <p className="mt-1 text-sm text-muted-foreground">
            Ujian: {formatUktRegistrationDeadline(data.examAt)}
            {data.examLocation ? ` · ${data.examLocation}` : ""}
          </p>
        )}
        {hint && (
          <p className="mt-2 text-sm text-muted-foreground">{hint.text}</p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {showRegister && data.period.id ? (
            <Button
              size="sm"
              className="h-8 bg-inkai-red hover:bg-inkai-red/90"
              disabled={actionBusy}
              onClick={() => void handleRegister()}
            >
              {actionBusy ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : null}
              Daftar UKT sekarang
            </Button>
          ) : null}
          {showConfirmPay ? (
            <Button
              size="sm"
              className="h-8 bg-inkai-red hover:bg-inkai-red/90"
              disabled={actionBusy}
              onClick={() => void handleConfirmPayment()}
            >
              {actionBusy ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : null}
              Konfirmasi sudah bayar
            </Button>
          ) : null}
          {hint && (
            <Button asChild size="sm" variant="outline" className="h-8">
              <Link href={hint.href}>{hint.label}</Link>
            </Button>
          )}
          {(data.displayStatus === "belum_bayar" ||
            data.displayStatus === "menunggu_verifikasi") && (
            <Button asChild size="sm" variant="outline" className="h-8">
              <Link href="/dashboard/iuran">
                <Wallet className="mr-1 h-3.5 w-3.5" />
                Iuran
              </Link>
            </Button>
          )}
          <Link
            href="/dashboard/prestasi?tab=Sabuk"
            className="inline-flex h-8 items-center text-sm font-medium text-inkai-red hover:underline"
          >
            Riwayat sabuk
            <ChevronRight className="ml-0.5 h-4 w-4" />
          </Link>
        </div>
      </div>

      {gateBlockers && gateBlockers.length > 0 ? (
        <div className="fixed inset-0 z-[180] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            aria-label="Tutup"
            onClick={() => setGateBlockers(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            className="relative z-[1] w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-xl"
          >
            <h2 className="text-lg font-extrabold">Syarat UKT belum lengkap</h2>
            <ul className="mt-3 space-y-3 text-left text-sm">
              {gateBlockers.map((b) => {
                const copy = BLOCKER_COPY[b];
                return (
                  <li key={b} className="rounded-xl border border-border/60 p-3">
                    <p className="font-semibold">{copy.title}</p>
                    <p className="mt-1 text-muted-foreground">{copy.body}</p>
                    {copy.href !== "#" ? (
                      <Link
                        href={copy.href}
                        className="mt-2 inline-block text-sm font-medium text-inkai-red hover:underline"
                        onClick={() => setGateBlockers(null)}
                      >
                        {copy.cta}
                      </Link>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              onClick={() => setGateBlockers(null)}
              className="mt-4 w-full rounded-xl border border-border py-3 text-sm font-semibold"
            >
              Tutup
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
