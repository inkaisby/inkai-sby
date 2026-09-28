"use client";

import Link from "next/link";
import { Trophy, Calendar, MapPin, CheckCircle, Scale, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { MemberPertandinganPayload } from "@/lib/member-pertandingan-status";

type Props = {
  compact?: boolean;
  data: MemberPertandinganPayload | null;
};

export function PertandinganStatusCard({ compact = false, data }: Props) {
  if (!data?.event) return null;

  const { event, registered, registration } = data;

  const statusBadge = () => {
    if (!registered) {
      return (
        <Badge className="bg-blue-500/15 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
          Pendaftaran Terbuka
        </Badge>
      );
    }
    const status = registration?.status;
    if (status === "VERIFIED") {
      return (
        <Badge className="bg-emerald-500/15 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 flex items-center gap-1">
          <CheckCircle className="w-3 h-3 text-emerald-600" /> SAH (Lolos Timbang)
        </Badge>
      );
    }
    if (status === "PAID") {
      return (
        <Badge className="bg-blue-500/15 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 flex items-center gap-1">
          <CheckCircle className="w-3 h-3 text-blue-600" /> LUNAS
        </Badge>
      );
    }
    if (status === "REJECTED") {
      return (
        <Badge className="bg-red-500/15 text-red-700 dark:bg-red-950/50 dark:text-red-300">
          REJECTED / DISKUALIFIKASI
        </Badge>
      );
    }
    return (
      <Badge className="bg-amber-500/15 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
        TERCATAT
      </Badge>
    );
  };

  const startDateFormatted = new Date(event.startDate).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div
      className={`rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-card p-4 ${
        compact ? "" : "mb-6"
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <Trophy className="h-4 w-4 text-amber-500" />
          Status Pertandingan / Kejuaraan
        </div>
        {statusBadge()}
      </div>

      <p className="font-bold text-base">{event.title}</p>

      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5 text-amber-500" />
          {startDateFormatted} {event.eventTime ? `· ${event.eventTime}` : ""}
        </span>
        {event.location && (
          <span className="flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-amber-500" />
            {event.location}
          </span>
        )}
      </div>

      {registered && registration ? (
        <div className="mt-2 text-xs space-y-1 bg-amber-500/10 dark:bg-amber-950/30 p-2.5 rounded-xl border border-amber-500/20">
          <div className="font-bold text-foreground">
            Kelas: {registration.category?.name || "Kelas Pertandingan"}
          </div>
          <div className="text-muted-foreground flex items-center gap-1.5">
            <Scale className="w-3.5 h-3.5 text-amber-600" />
            Berat Badan:{" "}
            <span className="font-bold text-foreground">
              {registration.actualWeight ? `${registration.actualWeight} kg` : "Belum timbang"}
            </span>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          Pendaftaran kejuaraan ini sedang berlangsung. Daftarkan diri Anda atau atlet dojo Anda.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" asChild className="h-8 bg-amber-600 hover:bg-amber-500 text-white font-bold">
          <Link href="/dashboard/pertandingan">
            {registered ? "Kelola Pendaftaran Pertandingan" : "Daftar Pertandingan sekarang"}
            <ChevronRight className="ml-1 h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
