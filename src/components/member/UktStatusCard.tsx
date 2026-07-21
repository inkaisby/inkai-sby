"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Award, ChevronRight, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRankLabel } from "@/lib/belt";
import { formatUktRegistrationDeadline, type UktDisplayStatus } from "@/lib/ukt";

type UktStatusPayload = {
  period?: { title?: string; semester?: string; year?: number };
  registered?: boolean;
  statusLabel?: string;
  displayStatus?: UktDisplayStatus;
  kyuLama?: string;
  kyuBaru?: string | null;
  examAt?: string | null;
  examLocation?: string | null;
};

const STATUS_CLASS: Partial<Record<UktDisplayStatus, string>> = {
  belum_daftar: "bg-muted text-muted-foreground",
  belum_bayar: "bg-amber-500/15 text-amber-700",
  menunggu_verifikasi: "bg-amber-500/15 text-amber-700",
  menunggu_ujian: "bg-blue-500/15 text-blue-700",
  lulus: "bg-emerald-500/15 text-emerald-700",
  selesai: "bg-emerald-600 text-white",
  gagal: "bg-red-500/15 text-red-700",
  mengulang: "bg-orange-500/15 text-orange-700",
};

function nextStepHint(status?: UktDisplayStatus): { text: string; href: string; label: string } | null {
  switch (status) {
    case "belum_daftar":
      return {
        text: "Hubungi ketua ranting untuk pendaftaran UKT periode ini.",
        href: "/dashboard/prestasi?tab=Sabuk",
        label: "Info sabuk & UKT",
      };
    case "belum_bayar":
      return {
        text: "Koordinasikan pembayaran UKT dengan ketua ranting (nota).",
        href: "/dashboard/iuran",
        label: "Lihat tagihan",
      };
    case "menunggu_verifikasi":
      return {
        text: "Pembayaran sedang diverifikasi cabang.",
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
    default:
      return null;
  }
}

type Props = {
  compact?: boolean;
};

export function UktStatusCard({ compact = false }: Props) {
  const [data, setData] = useState<UktStatusPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/member/ukt-status")
      .then((r) => r.json())
      .then((json) => setData(json))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

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

  return (
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
        {hint && (
          <Button asChild size="sm" variant="outline" className="h-8">
            <Link href={hint.href}>{hint.label}</Link>
          </Button>
        )}
        {(data.displayStatus === "belum_bayar" || data.displayStatus === "menunggu_verifikasi") && (
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
  );
}
