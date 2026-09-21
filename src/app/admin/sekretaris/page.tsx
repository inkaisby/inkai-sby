import React from "react";
import Link from "next/link";
import { requireAdminSession } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { buildSekretarisFilter, resolveSekretarisScopeLabel } from "@/lib/sekretaris-rbac";
import {
  FileText,
  Mail,
  Send,
  Inbox,
  FolderKanban,
  CalendarDays,
  Plus,
  ArrowRight,
  Clock,
  ShieldCheck,
  AlertTriangle,
  FileSpreadsheet,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SekretarisDashboardPage() {
  const { session } = await requireAdminSession();
  const filter = buildSekretarisFilter(session.user);
  const scopeInfo = await resolveSekretarisScopeLabel(session.user, prisma);

  // Fetch KPI statistics
  const [totalSuratKeluar, totalSuratMasuk, pendingApproval, totalDokumen, totalRapat] = await Promise.all([
    prisma.suratEntry.count({ where: { ...filter, type: "KELUAR" } }),
    prisma.suratEntry.count({ where: { ...filter, type: "MASUK" } }),
    prisma.suratEntry.count({ where: { ...filter, status: "WAITING_APPROVAL" } }),
    prisma.arsipDokumen.count({ where: filter }),
    prisma.notulenRapat.count({ where: filter }),
  ]);

  // Fetch recent letters
  const recentSurat = await prisma.suratEntry.findMany({
    where: filter,
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  // Fetch upcoming/recent meeting minutes
  const recentRapat = await prisma.notulenRapat.findMany({
    where: filter,
    orderBy: { tanggalRapat: "desc" },
    take: 3,
  });

  // Fetch expiring SK documents (expiry in next 45 days)
  const now = new Date();
  const next45Days = new Date();
  next45Days.setDate(now.getDate() + 45);

  const expiringDokumen = await prisma.arsipDokumen.findMany({
    where: {
      ...filter,
      tanggalKadaluarsa: {
        gte: now,
        lte: next45Days,
      },
    },
    take: 5,
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 p-6 rounded-3xl shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-red-600 uppercase tracking-wider mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-700">
              <ShieldCheck className="w-3.5 h-3.5 text-red-600" />
              Otoritas: {scopeInfo.scopeName}
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Dashboard Sekretariat & Administrasi
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Kelola persuratan resmi, generator surat PDF, kearsipan SK, dan notulensi rapat INKAI Surabaya.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/admin/sekretaris/generator"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md shadow-red-600/20 transition active:scale-95"
          >
            <Plus className="w-4 h-4" /> Generator Surat PDF
          </Link>
          <Link
            href="/admin/sekretaris/surat"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 font-bold text-xs transition active:scale-95"
          >
            <Mail className="w-4 h-4 text-red-600" /> Surat Masuk & Keluar
          </Link>
        </div>
      </div>

      {/* SK Expiry Alert Banner if any */}
      {expiringDokumen.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs text-amber-900">
            <span className="font-bold text-amber-950">Peringatan Masa Berlaku SK Dokumen:</span> Terdapat{" "}
            <strong>{expiringDokumen.length} dokumen SK</strong> yang akan kadaluarsa dalam 45 hari ke depan.
            <div className="mt-2 flex flex-wrap gap-2">
              {expiringDokumen.map((doc) => (
                <span key={doc.id} className="inline-block bg-amber-100 border border-amber-300 px-2.5 py-1 rounded-lg font-mono text-[11px] text-amber-950">
                  {doc.judul} ({doc.tanggalKadaluarsa ? new Date(doc.tanggalKadaluarsa).toLocaleDateString("id-ID") : ""})
                </span>
              ))}
            </div>
          </div>
          <Link
            href="/admin/sekretaris/dokumen"
            className="px-3 py-1.5 rounded-xl bg-amber-600 text-white font-bold text-xs hover:bg-amber-700 transition shrink-0"
          >
            Perbarui SK
          </Link>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Surat Keluar</span>
            <div className="w-7 h-7 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
              <Send className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">{totalSuratKeluar}</div>
          <div className="text-[11px] text-slate-500 mt-1">Surat resmi diterbitkan</div>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Surat Masuk</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Inbox className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">{totalSuratMasuk}</div>
          <div className="text-[11px] text-slate-500 mt-1">Surat masuk registered</div>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Menunggu Otorisasi</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-600">{pendingApproval}</div>
          <div className="text-[11px] text-slate-500 mt-1">Draft menunggu TTD</div>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Dokumen SK</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <FolderKanban className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">{totalDokumen}</div>
          <div className="text-[11px] text-slate-500 mt-1">Arsip berkas digital</div>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Notulensi Rapat</span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <CalendarDays className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">{totalRapat}</div>
          <div className="text-[11px] text-slate-500 mt-1">Risalah & action items</div>
        </div>
      </div>

      {/* Quick Action Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <Link
          href="/admin/sekretaris/generator"
          className="group p-5 bg-white border border-slate-200 hover:border-red-300 rounded-2xl transition shadow-sm hover:shadow-md flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center mb-3 font-bold group-hover:scale-110 transition">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base group-hover:text-red-600 transition">
              Generator Surat A4/F4
            </h3>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Buat Surat Tugas, Undangan, SK, & Keterangan dengan WYSIWYG editor & cetak 1-klik.
            </p>
          </div>
          <div className="mt-4 flex items-center text-xs font-bold text-red-600 gap-1">
            Buka Generator <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
          </div>
        </Link>

        <Link
          href="/admin/sekretaris/surat"
          className="group p-5 bg-white border border-slate-200 hover:border-blue-300 rounded-2xl transition shadow-sm hover:shadow-md flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3 font-bold group-hover:scale-110 transition">
              <Mail className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base group-hover:text-blue-600 transition">
              Buku Surat Masuk & Keluar
            </h3>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Registrasi penomoran otomatis, disposisi surat masuk, & delivery surat ke portal anggota.
            </p>
          </div>
          <div className="mt-4 flex items-center text-xs font-bold text-blue-600 gap-1">
            Kelola Persuratan <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
          </div>
        </Link>

        <Link
          href="/admin/sekretaris/dokumen"
          className="group p-5 bg-white border border-slate-200 hover:border-emerald-300 rounded-2xl transition shadow-sm hover:shadow-md flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3 font-bold group-hover:scale-110 transition">
              <FolderKanban className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base group-hover:text-emerald-600 transition">
              Repository Dokumen SK
            </h3>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Kearsipan digital SK Pengurus, AD/ART, LPJ, & sertifikat organisasi.
            </p>
          </div>
          <div className="mt-4 flex items-center text-xs font-bold text-emerald-600 gap-1">
            Arsip Dokumen <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
          </div>
        </Link>

        <Link
          href="/admin/sekretaris/rapat"
          className="group p-5 bg-white border border-slate-200 hover:border-purple-300 rounded-2xl transition shadow-sm hover:shadow-md flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-3 font-bold group-hover:scale-110 transition">
              <CalendarDays className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base group-hover:text-purple-600 transition">
              Notulen & Agenda Rapat
            </h3>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Catat risalah rapat, kelola action items tugas, & export ringkasan WhatsApp.
            </p>
          </div>
          <div className="mt-4 flex items-center text-xs font-bold text-purple-600 gap-1">
            Notulen Rapat <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
          </div>
        </Link>
      </div>

      {/* Main Content Feed Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Surat (2 Cols) */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="font-bold text-slate-900 text-lg flex items-center gap-2">
              <FileText className="w-5 h-5 text-red-600" /> Surat Terkini
            </h2>
            <Link
              href="/admin/sekretaris/surat"
              className="text-xs text-red-600 hover:text-red-700 font-bold flex items-center gap-1"
            >
              Lihat Semua ({totalSuratKeluar + totalSuratMasuk}) <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {recentSurat.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
              Belum ada surat terdaftar. Klik tombol <strong>Generator Surat</strong> untuk membuat surat resmi pertama.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentSurat.map((item) => (
                <div key={item.id} className="py-3 flex items-center justify-between gap-4 hover:bg-slate-50/80 px-2 rounded-xl transition">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-xs font-mono text-red-600 font-bold">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-sans font-bold ${
                        item.type === "KELUAR" ? "bg-red-50 text-red-700 border border-red-200" : "bg-blue-50 text-blue-700 border border-blue-200"
                      }`}>
                        {item.type}
                      </span>
                      <span>{item.nomorSurat}</span>
                      <span className="text-slate-300">&bull;</span>
                      <span className="text-slate-500 font-sans">{new Date(item.tanggalSurat).toLocaleDateString("id-ID")}</span>
                    </div>
                    <div className="font-bold text-slate-900 text-sm truncate mt-0.5">{item.perihal}</div>
                    <div className="text-xs text-slate-500 truncate mt-0.5">
                      {item.type === "KELUAR" ? `Tujuan: ${item.tujuan || "-"}` : `Pengirim: ${item.pengirim || "-"}`}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${
                      item.status === "ISSUED" || item.status === "APPROVED"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : item.status === "WAITING_APPROVAL"
                        ? "bg-amber-50 text-amber-700 border border-amber-200"
                        : "bg-slate-100 text-slate-600 border border-slate-200"
                    }`}>
                      {item.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Rapat & Action Items (1 Col) */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="font-bold text-slate-900 text-lg flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-purple-600" /> Agenda & Risalah Rapat
            </h2>
            <Link
              href="/admin/sekretaris/rapat"
              className="text-xs text-purple-600 hover:text-purple-700 font-bold flex items-center gap-1"
            >
              Lihat <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {recentRapat.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
              Belum ada notulen rapat tercatat.
            </div>
          ) : (
            <div className="space-y-3">
              {recentRapat.map((rapat) => (
                <div key={rapat.id} className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-1.5 hover:bg-slate-100/60 transition">
                  <div className="flex items-center justify-between text-xs text-purple-700 font-semibold">
                    <span>{new Date(rapat.tanggalRapat).toLocaleDateString("id-ID")}</span>
                    <span>Pimpinan: {rapat.pimpinanRapat || "-"}</span>
                  </div>
                  <div className="font-bold text-slate-900 text-sm">{rapat.judulRapat}</div>
                  <p className="text-xs text-slate-600 line-clamp-2">{rapat.agenda}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

