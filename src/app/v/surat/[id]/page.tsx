import React from "react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { CheckCircle2, ShieldCheck, XCircle, FileText, Calendar, Building2, User } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SuratVerificationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const surat = await prisma.suratEntry.findUnique({
    where: { id },
  });

  if (!surat) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-2xl p-6 text-center shadow-xl">
          <div className="w-16 h-16 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-10 h-10" />
          </div>
          <h1 className="text-xl font-bold text-red-400 mb-2">Surat Tidak Ditemukan / Tidak Valid</h1>
          <p className="text-slate-400 text-sm mb-6">
            Nomor verifikasi surat ini tidak terdaftar di sistem basis data resmi Pengurus INKAI Cabang Surabaya.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-slate-700 text-white hover:bg-slate-600 transition font-medium text-sm"
          >
            Kembali ke Beranda
          </Link>
        </div>
      </div>
    );
  }

  const formattedDate = surat.tanggalSurat
    ? new Date(surat.tanggalSurat).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "-";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4">
      <div className="max-w-xl w-full bg-slate-900 border border-emerald-500/30 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Badge status keabsahan */}
        <div className="flex items-center gap-3 bg-emerald-500/15 border border-emerald-500/40 rounded-2xl p-4 mb-6">
          <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center shrink-0">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-base">
              <CheckCircle2 className="w-4 h-4" /> Dokumen Resmi Terverifikasi
            </div>
            <div className="text-xs text-slate-300">
              Surat ini terdaftar sah & terautentikasi di database INKAI Cabang Surabaya.
            </div>
          </div>
        </div>

        {/* Header kop singkat */}
        <div className="text-center border-b border-slate-800 pb-5 mb-5">
          <div className="text-xs uppercase tracking-widest text-emerald-400 font-semibold mb-1">
            Pengurus Kota Institut Karate-Do Indonesia Surabaya
          </div>
          <h1 className="text-xl md:text-2xl font-black text-white">{surat.perihal}</h1>
          <div className="inline-block mt-2 px-3 py-1 bg-slate-800 rounded-lg text-slate-300 font-mono text-sm border border-slate-700">
            No: {surat.nomorSurat}
          </div>
        </div>

        {/* Metadata detail */}
        <div className="space-y-4 text-sm">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-800/60 border border-slate-800">
            <FileText className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs text-slate-400">Kategori Surat</div>
              <div className="font-semibold text-slate-200">{surat.kategori}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-800/60 border border-slate-800">
              <Calendar className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs text-slate-400">Tanggal Surat</div>
                <div className="font-semibold text-slate-200">{formattedDate}</div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-800/60 border border-slate-800">
              <Building2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs text-slate-400">Scope Wilayah</div>
                <div className="font-semibold text-slate-200">{surat.scopeType} ({surat.scopeId})</div>
              </div>
            </div>
          </div>

          {surat.pengirim && (
            <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-800/60 border border-slate-800">
              <User className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs text-slate-400">Pengirim / Penerbit</div>
                <div className="font-semibold text-slate-200">{surat.pengirim}</div>
              </div>
            </div>
          )}

          {surat.tujuan && (
            <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-800/60 border border-slate-800">
              <User className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs text-slate-400">Tujuan / Kepada</div>
                <div className="font-semibold text-slate-200">{surat.tujuan}</div>
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="mt-8 pt-4 border-t border-slate-800 text-center text-xs text-slate-400">
          <div>Portal Resmi INKAI Surabaya &copy; {new Date().getFullYear()}</div>
          <div className="mt-1 text-[11px] text-slate-400">Halaman verifikasi publik keabsahan dokumen organisasi.</div>
        </div>
      </div>
    </div>
  );
}
