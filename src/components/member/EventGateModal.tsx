"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import type { EventGateReason } from "@/lib/memberCompleteness";

const COPY: Record<
  Exclude<EventGateReason, null>,
  { title: string; body: string; cta: string; href: string }
> = {
  profile: {
    title: "Profil Belum Lengkap",
    body: "Lengkapi data diri Anda (foto, nomor WA, tempat & tanggal lahir, alamat, serta dojo) sebelum mendaftar kegiatan.",
    cta: "Lengkapi Profil",
    href: "/dashboard/profil",
  },
  documents: {
    title: "Dokumen Belum Lengkap",
    body: "Unggah dokumen wajib (Akte Kelahiran & BPJS) sebelum mendaftar kegiatan.",
    cta: "Lengkapi Dokumen",
    href: "/dashboard/dokumen",
  },
  iuran: {
    title: "Iuran Bulanan Belum Lunas",
    body: "Iuran bulanan wajib diselesaikan terlebih dahulu untuk dapat mendaftar kegiatan.",
    cta: "Bayar Iuran Sekarang",
    href: "/dashboard/iuran",
  },
};

export function EventGateModal({
  reason,
  onClose,
}: {
  reason: EventGateReason;
  onClose: () => void;
}) {
  if (!reason) return null;
  const copy = COPY[reason];

  return (
    <div className="fixed inset-0 z-[180] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Tutup"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-[1] w-full max-w-sm rounded-3xl border border-border bg-card p-6 text-center shadow-xl animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-500">
          <Lock size={28} />
        </div>
        <h2 className="text-lg font-extrabold">{copy.title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{copy.body}</p>
        <div className="mt-5 flex flex-col gap-2">
          <Link
            href={copy.href}
            className="rounded-xl bg-inkai-red py-3 text-sm font-semibold text-white hover:bg-inkai-red/90"
            onClick={onClose}
          >
            {copy.cta}
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border py-3 text-sm font-semibold"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
