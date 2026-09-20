import React from "react";
import Link from "next/link";
import { requireAdminSession } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { buildSekretarisFilter, resolveSekretarisScope } from "@/lib/sekretaris-rbac";
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
  const scope = resolveSekretarisScope(session.user);

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
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-red-400 uppercase tracking-widest mb-1">
            <ShieldCheck className="w-4 h-4" /> Scope: {scope.scopeType} ({scope.scopeId})
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Dashboard Sekretariat & Administrasi
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Kelola persuratan resmi, generator surat PDF, kearsipan SK, dan notulensi rapat INKAI Surabaya.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/sekretaris/generator"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-lg shadow-red-600/30 transition"
          >
            <Plus className="w-4 h-4" /> Generator Surat PDF
          </Link>
          <Link
            href="/admin/sekretaris/surat"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs transition"
          >
            <Mail className="w-4 h-4 text-red-400" /> Surat Masuk & Keluar
          </Link>
        </div>
      </div>

      {/* SK Expiry Alert Banner if any */}
      {expiringDokumen.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs text-amber-200">
            <span className="font-bold text-amber-400">Peringatan Masa Berlaku SK Dokumen:</span> Terdapat{" "}
            <strong>{expiringDokumen.length} dokumen SK</strong> yang akan kadaluarsa dalam 45 hari ke depan.
            <div className="mt-2 flex flex-wrap gap-2">
              {expiringDokumen.map((doc) => (
                <span key={doc.id} className="inline-block bg-amber-950/80 border border-amber-500/40 px-2.5 py-1 rounded-lg font-mono text-[11px] text-amber-300">
                  {doc.judul} ({doc.tanggalKadaluarsa ? new Date(doc.tanggalKadaluarsa).toLocaleDateString("id-ID") : ""})
                </span>
              ))}
            </div>
          </div>
          <Link
            href="/admin/sekretaris/dokumen"
            className="px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition"
          >
            Perbarui SK
          </Link>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-md">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Surat Keluar</span>
            <Send className="w-4 h-4 text-red-400" />
          </div>
          <div className="text-2xl font-black text-white">{totalSuratKeluar}</div>
          <div className="text-[11px] text-slate-400 mt-1">Surat resmi diterbitkan</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-md">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Surat Masuk</span>
            <Inbox className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-white">{totalSuratMasuk}</div>
          <div className="text-[11px] text-slate-400 mt-1">Surat masuk registered</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-md">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Menunggu Otorisasi</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400">{pendingApproval}</div>
          <div className="text-[11px] text-slate-400 mt-1">Draft menunggu TTD</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-md">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Dokumen SK</span>
            <FolderKanban className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-white">{totalDokumen}</div>
          <div className="text-[11px] text-slate-400 mt-1">Arsip berkas digital</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-md">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Notulensi Rapat</span>
            <CalendarDays className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-black text-white">{totalRapat}</div>
          <div className="text-[11px] text-slate-400 mt-1">Risalah & action items</div>
        </div>
      </div>

      {/* Quick Action Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Link
          href="/admin/sekretaris/generator"
          className="group p-5 bg-gradient-to-br from-red-950/40 to-slate-900 border border-red-500/20 hover:border-red-500/50 rounded-2xl transition shadow-lg flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-red-600/20 text-red-400 flex items-center justify-center mb-3 font-bold group-hover:scale-110 transition">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-base group-hover:text-red-400 transition">
              Generator Surat A4/F4
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Buat Surat Tugas, Undangan, SK, & Keterangan dengan WYSIWYG editor & cetak 1-klik.
            </p>
          </div>
          <div className="mt-4 flex items-center text-xs font-semibold text-red-400 gap-1">
            Buka Generator <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </Link>

        <Link
          href="/admin/sekretaris/surat"
          className="group p-5 bg-gradient-to-br from-blue-950/40 to-slate-900 border border-blue-500/20 hover:border-blue-500/50 rounded-2xl transition shadow-lg flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center mb-3 font-bold group-hover:scale-110 transition">
              <Mail className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-base group-hover:text-blue-400 transition">
              Buku Surat Masuk & Keluar
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Registrasi penomoran otomatis, disposisi surat masuk, & delivery surat ke portal anggota.
            </p>
          </div>
          <div className="mt-4 flex items-center text-xs font-semibold text-blue-400 gap-1">
            Kelola Persuratan <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </Link>

        <Link
          href="/admin/sekretaris/dokumen"
          className="group p-5 bg-gradient-to-br from-emerald-950/40 to-slate-900 border border-emerald-500/20 hover:border-emerald-500/50 rounded-2xl transition shadow-lg flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center mb-3 font-bold group-hover:scale-110 transition">
              <FolderKanban className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-base group-hover:text-emerald-400 transition">
              Repository Dokumen SK
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Kearsipan digital SK Pengurus, AD/ART, LPJ, & sertifikat organisasi.
            </p>
          </div>
          <div className="mt-4 flex items-center text-xs font-semibold text-emerald-400 gap-1">
            Arsip Dokumen <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </Link>

        <Link
          href="/admin/sekretaris/rapat"
          className="group p-5 bg-gradient-to-br from-purple-950/40 to-slate-900 border border-purple-500/20 hover:border-purple-500/50 rounded-2xl transition shadow-lg flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center mb-3 font-bold group-hover:scale-110 transition">
              <CalendarDays className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-base group-hover:text-purple-400 transition">
              Notulen & Agenda Rapat
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Catat risalah rapat, kelola action items tugas, & export ringkasan WhatsApp.
            </p>
          </div>
          <div className="mt-4 flex items-center text-xs font-semibold text-purple-400 gap-1">
            Notulen Rapat <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </Link>
      </div>

      {/* Main Content Feed Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Surat (2 Cols) */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h2 className="font-bold text-white text-lg flex items-center gap-2">
              <FileText className="w-5 h-5 text-red-400" /> Surat Terkini
            </h2>
            <Link
              href="/admin/sekretaris/surat"
              className="text-xs text-red-400 hover:text-red-300 font-semibold flex items-center gap-1"
            >
              Lihat Semua ({totalSuratKeluar + totalSuratMasuk}) <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {recentSurat.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-xs">
              Belum ada surat terdaftar. Klik tombol <strong>Generator Surat</strong> untuk membuat surat resmi pertama.
            </div>
          ) : (
            <div className="divide-y divide-slate-800/80">
              {recentSurat.map((item) => (
                <div key={item.id} className="py-3 flex items-center justify-between gap-4 hover:bg-slate-800/30 px-2 rounded-xl transition">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-xs font-mono text-red-400 font-semibold">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-sans font-bold ${
                        item.type === "KELUAR" ? "bg-red-500/20 text-red-300" : "bg-blue-500/20 text-blue-300"
                      }`}>
                        {item.type}
                      </span>
                      <span>{item.nomorSurat}</span>
                      <span className="text-slate-500">&bull;</span>
                      <span className="text-slate-400">{new Date(item.tanggalSurat).toLocaleDateString("id-ID")}</span>
                    </div>
                    <div className="font-semibold text-slate-200 text-sm truncate mt-0.5">{item.perihal}</div>
                    <div className="text-xs text-slate-400 truncate mt-0.5">
                      {item.type === "KELUAR" ? `Tujuan: ${item.tujuan || "-"}` : `Pengirim: ${item.pengirim || "-"}`}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${
                      item.status === "ISSUED" || item.status === "APPROVED"
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        : item.status === "WAITING_APPROVAL"
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                        : "bg-slate-800 text-slate-400 border border-slate-700"
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
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h2 className="font-bold text-white text-lg flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-purple-400" /> Agenda & Risalah Rapat
            </h2>
            <Link
              href="/admin/sekretaris/rapat"
              className="text-xs text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-1"
            >
              Lihat <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {recentRapat.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-xs">
              Belum ada notulen rapat tercatat.
            </div>
          ) : (
            <div className="space-y-3">
              {recentRapat.map((rapat) => (
                <div key={rapat.id} className="p-3 bg-slate-800/60 border border-slate-800 rounded-2xl space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-purple-300 font-medium">
                    <span>{new Date(rapat.tanggalRapat).toLocaleDateString("id-ID")}</span>
                    <span>Pimpinan: {rapat.pimpinanRapat || "-"}</span>
                  </div>
                  <div className="font-bold text-white text-sm">{rapat.judulRapat}</div>
                  <p className="text-xs text-slate-400 line-clamp-2">{rapat.agenda}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
