"use client";

import { useEffect, useState } from "react";
import {
  Trophy,
  Calendar,
  MapPin,
  CheckCircle,
  Clock,
  Swords,
  User,
  Building,
  CreditCard,
  Plus,
  BookOpen,
  ShieldCheck,
  QrCode,
  Send,
  X,
  Scale,
  Upload,
  FileText,
  Eye,
} from "lucide-react";
import { compressUploadFile } from "@/lib/compress-image";
import { showError, showSuccess } from "@/lib/client-toast";

interface Member {
  id: string;
  fullName: string;
  nia?: string;
  currentRank: string;
  gender?: string;
  birthDate?: string;
  dojo: { name: string };
}

interface TournamentCategory {
  id: string;
  name: string;
  categoryType: string;
  gender: string;
  fee: number;
  isFeeVisible?: boolean;
}

interface EventItem {
  id: string;
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  location?: string;
  rulesContent?: string | null;
  tournamentCategories: TournamentCategory[];
}

interface Registration {
  id: string;
  eventId: string;
  categoryId: string;
  status: string;
  actualWeight?: number | null;
  certificateUrl?: string | null;
  notes?: string | null;
  createdAt: string;
  event: { title: string; startDate: string; location?: string };
  category: { name: string; fee: number; isFeeVisible?: boolean; categoryType: string };
}

export default function MemberPertandinganPage() {
  const [member, setMember] = useState<Member | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [myRegistrations, setMyRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);

  // Upload & Preview State
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [previewCertificateUrl, setPreviewCertificateUrl] = useState<string | null>(null);

  const handleUploadCertificate = async (regId: string, file: File) => {
    setUploadingId(regId);
    try {
      const compressed = await compressUploadFile(file, 150 * 1024);
      const formData = new FormData();
      formData.append("file", compressed);
      formData.append("folder", "piagam-pertandingan");

      const resUpload = await fetch("/api/public/upload", {
        method: "POST",
        body: formData,
      });
      const uploadData = await resUpload.json();
      if (!resUpload.ok) throw new Error(uploadData.error || "Gagal mengunggah piagam");

      const certificateUrl = uploadData.url;

      const res = await fetch("/api/public/pertandingan", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: regId, certificateUrl }),
      });

      if (res.ok) {
        showSuccess("Piagam kejuaraan berhasil diunggah (terkompres ≤ 150KB)");
        fetchData();
      } else {
        showError("Gagal memperbarui data piagam");
      }
    } catch (err: any) {
      showError(err.message || "Gagal mengunggah piagam");
    } finally {
      setUploadingId(null);
    }
  };

  // Registration Form State
  const [selectedEventId, setSelectedEventId] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [officialName, setOfficialName] = useState("");
  const [officialPhone, setOfficialPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"TRANSFER" | "CASH">("TRANSFER");
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showPaymentInstructions, setShowPaymentInstructions] = useState<Registration | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/member/pertandingan");
      const data = await res.json();
      if (data.member) setMember(data.member);
      if (data.events) {
        setEvents(data.events);
        if (data.events.length > 0) setSelectedEventId(data.events[0].id);
      }
      if (data.myRegistrations) setMyRegistrations(data.myRegistrations);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateWeight = async (id: string, actualWeight: number | null) => {
    try {
      const res = await fetch("/api/public/pertandingan", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, actualWeight }),
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventId || !selectedCategoryId) {
      alert("Pilih event dan kategori kelas pertandingan");
      return;
    }

    if (!agreedTerms) {
      alert("Anda harus menyetujui Ketentuan & Peraturan Pertandingan terlebih dahulu.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/member/pertandingan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: selectedEventId,
          categoryId: selectedCategoryId,
          officialName,
          officialPhone,
          notes: `[${paymentMethod}]`,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        alert("Berhasil mendaftar kejuaraan!");
        setSelectedCategoryId("");
        setAgreedTerms(false);
        fetchData();
      } else {
        alert(data.error || "Gagal melakukan pendaftaran");
      }
    } catch (err) {
      console.error(err);
      alert("Terjadi kesalahan sistem");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedEvent = events.find((e) => e.id === selectedEventId);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-red-900 via-red-800 to-red-950 text-white p-6 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Trophy className="w-8 h-8 text-yellow-400 animate-pulse" />
            <h1 className="text-2xl font-bold tracking-tight">Pendaftaran Kejuaraan Karate Mandiri</h1>
          </div>
          <p className="text-sm text-red-200">
            Daftar kompetisi Kata & Kumite resmi INKAI Cabang Surabaya secara mandiri
          </p>
        </div>

        {member && (
          <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/20 text-xs space-y-0.5">
            <div className="font-semibold text-white">{member.fullName}</div>
            <div className="text-red-200">Dojo: {member.dojo.name}</div>
            <div className="text-yellow-300 font-medium">Sabuk: {member.currentRank}</div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Pendaftaran Mandiri */}
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <Swords className="w-5 h-5 text-red-600" />
            Formulir Pendaftaran Pertandingan
          </h2>

          {events.length === 0 ? (
            <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl text-xs text-zinc-500 text-center">
              Saat ini belum ada event kejuaraan yang membuka pendaftaran.
            </div>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Pilih Event Kejuaraan *</label>
                <select
                  required
                  value={selectedEventId}
                  onChange={(e) => {
                    setSelectedEventId(e.target.value);
                    setSelectedCategoryId("");
                    setAgreedTerms(false);
                  }}
                  className="w-full mt-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs font-medium"
                >
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title}
                    </option>
                  ))}
                </select>
              </div>

              {selectedEvent && (
                <div className="p-3 bg-red-50/50 dark:bg-red-950/30 rounded-xl border border-red-100 dark:border-red-900/50 text-xs space-y-2">
                  <div className="font-semibold text-red-900 dark:text-red-200">{selectedEvent.title}</div>
                  <div className="text-zinc-600 dark:text-zinc-400 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-red-500" />
                    {new Date(selectedEvent.startDate).toLocaleDateString("id-ID")} - {new Date(selectedEvent.endDate).toLocaleDateString("id-ID")}
                  </div>
                  <div className="text-zinc-600 dark:text-zinc-400 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-red-500" />
                    {selectedEvent.location || "Surabaya"}
                  </div>
                  
                  {selectedEvent.rulesContent && (
                    <button
                      type="button"
                      onClick={() => setShowRulesModal(true)}
                      className="w-full mt-2 py-1.5 px-3 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition shadow"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-yellow-300" />
                      Baca Ketentuan & Peraturan Pertandingan
                    </button>
                  )}
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Pilih Kelas Pertandingan *</label>
                <select
                  required
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs font-medium"
                >
                  <option value="">-- Pilih Kelas Kata / Kumite --</option>
                  {selectedEvent?.tournamentCategories?.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name} {cat.isFeeVisible !== false ? `(Rp ${cat.fee.toLocaleString("id-ID")})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Nama Official / Pelatih Ranting (Opsional)</label>
                <input
                  type="text"
                  placeholder="mis. Sensei Budi"
                  value={officialName}
                  onChange={(e) => setOfficialName(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">No. Kontak Official (Opsional)</label>
                <input
                  type="text"
                  placeholder="08123456789"
                  value={officialPhone}
                  onChange={(e) => setOfficialPhone(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Pilih Metode Pembayaran *</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("TRANSFER")}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                      paymentMethod === "TRANSFER"
                        ? "bg-blue-100 text-blue-900 border-blue-500 dark:bg-blue-950 dark:text-blue-200"
                        : "bg-zinc-50 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}
                  >
                    🏦 Transfer / QRIS
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("CASH")}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                      paymentMethod === "CASH"
                        ? "bg-emerald-100 text-emerald-900 border-emerald-500 dark:bg-emerald-950 dark:text-emerald-200"
                        : "bg-zinc-50 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}
                  >
                    💵 Tunai (Official / Kasir)
                  </button>
                </div>
              </div>

              {/* Persetujuan Ketentuan Pertandingan Checkbox */}
              <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
                <label className="flex items-start gap-2.5 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer p-2.5 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700">
                  <input
                    type="checkbox"
                    required
                    checked={agreedTerms}
                    onChange={(e) => setAgreedTerms(e.target.checked)}
                    className="mt-0.5 rounded border-zinc-300 text-red-600 focus:ring-red-500 w-4 h-4 flex-shrink-0"
                  />
                  <span className="leading-snug">
                    Saya telah membaca, memahami, dan <strong className="text-red-700 dark:text-red-400">menyetujui seluruh Ketentuan & Peraturan Pertandingan</strong> kejuaraan ini.
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={submitting || !agreedTerms || !selectedCategoryId}
                className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold text-sm rounded-xl transition shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                {submitting ? "Memproses..." : "Daftar Kejuaraan Ini"}
              </button>
            </form>
          )}
        </div>

        {/* Riwayat Pertandingan Saya */}
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            Riwayat Pertandingan Saya ({myRegistrations.length})
          </h2>

          {loading ? (
            <div className="py-8 text-center text-xs text-zinc-500">Memuat riwayat pendaftaran...</div>
          ) : myRegistrations.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-500">
              Anda belum terdaftar pada kelas pertandingan apapun.
            </div>
          ) : (
            <div className="space-y-3">
              {myRegistrations.map((reg) => (
                <div
                  key={reg.id}
                  className="p-4 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="font-bold text-sm text-zinc-900 dark:text-white">{reg.event.title}</div>
                    <div className="text-xs font-semibold text-red-600 dark:text-red-400">
                      Kelas: {reg.category.name}
                    </div>
                    <div className="text-xs text-zinc-500 flex items-center gap-2 flex-wrap">
                      <span>Tanggal: {new Date(reg.event.startDate).toLocaleDateString("id-ID")}</span>
                      {reg.category.isFeeVisible !== false && (
                        <>
                          <span>•</span>
                          <span>Biaya: Rp {reg.category.fee.toLocaleString("id-ID")}</span>
                        </>
                      )}
                    </div>
                    {/* Inline Berat Badan (BB) Input */}
                    <div className="pt-1.5 flex items-center gap-2">
                      <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
                        <Scale className="w-3.5 h-3.5 text-amber-500" /> BB (Berat Badan):
                      </span>
                      <div className="inline-flex items-center gap-1 bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-lg px-2 py-0.5">
                        <input
                          type="number"
                          step="0.1"
                          placeholder="kg"
                          defaultValue={reg.actualWeight !== null && reg.actualWeight !== undefined ? reg.actualWeight : ""}
                          onBlur={(e) => {
                            const val = e.target.value ? parseFloat(e.target.value) : null;
                            if (val !== reg.actualWeight) {
                              handleUpdateWeight(reg.id, val);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const val = (e.target as HTMLInputElement).value ? parseFloat((e.target as HTMLInputElement).value) : null;
                              if (val !== reg.actualWeight) {
                                handleUpdateWeight(reg.id, val);
                              }
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          className="w-16 px-1.5 py-0.5 bg-white dark:bg-zinc-900 border border-amber-300 dark:border-amber-700 rounded text-xs font-bold text-amber-900 dark:text-amber-200 text-center focus:ring-2 focus:ring-amber-500 focus:outline-none"
                        />
                        <span className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold">kg</span>
                      </div>
                    </div>

                    {/* Berkas Dokumen: Upload Piagam */}
                    <div className="pt-1.5 flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5 text-blue-500" /> Piagam Kejuaraan:
                      </span>
                      {reg.certificateUrl ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setPreviewCertificateUrl(reg.certificateUrl!)}
                            className="px-2 py-0.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 rounded text-[11px] font-bold flex items-center gap-1 transition"
                          >
                            <Eye className="w-3 h-3" /> Lihat Piagam
                          </button>
                          <label className="cursor-pointer px-2 py-0.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded text-[11px] font-medium flex items-center gap-1 transition">
                            <Upload className="w-3 h-3" /> Ganti
                            <input
                              type="file"
                              accept="image/*,.pdf"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handleUploadCertificate(reg.id, f);
                              }}
                            />
                          </label>
                        </div>
                      ) : (
                        <label className="cursor-pointer px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 shadow transition">
                          <Upload className="w-3 h-3" />
                          {uploadingId === reg.id ? "Mengompres & Upload..." : "Upload Piagam (≤150KB)"}
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            disabled={uploadingId === reg.id}
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleUploadCertificate(reg.id, f);
                            }}
                          />
                        </label>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col md:items-end gap-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                        reg.status === "VERIFIED" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300" :
                        reg.status === "PAID" ? "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300" :
                        "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                      }`}>
                        {reg.status === "VERIFIED" && <CheckCircle className="w-3.5 h-3.5" />}
                        {reg.status === "PAID" && <CheckCircle className="w-3.5 h-3.5" />}
                        {reg.status === "REGISTERED" && <Clock className="w-3.5 h-3.5" />}
                        {reg.status === "VERIFIED" ? "TERVERIFIKASI SAH" : reg.status === "PAID" ? "LUNAS" : "TERCATAT"}
                      </span>

                      {reg.notes?.includes("CASH") ? (
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded text-[11px] font-bold">
                          💵 Tunai
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded text-[11px] font-bold">
                          🏦 Transfer / QRIS
                        </span>
                      )}
                    </div>

                    {!reg.notes?.includes("CASH") && (
                      <button
                        onClick={() => setShowPaymentInstructions(reg)}
                        className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                      >
                        <CreditCard className="w-3.5 h-3.5" /> Petunjuk Bayar (QRIS/Bank)
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal Ketentuan Pertandingan untuk Anggota */}
      {showRulesModal && selectedEvent && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-3 border-zinc-200 dark:border-zinc-800">
              <h3 className="font-bold text-base text-zinc-900 dark:text-white flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-red-600" />
                Ketentuan & Peraturan Pertandingan: {selectedEvent.title}
              </h3>
              <button onClick={() => setShowRulesModal(false)} className="text-zinc-500 hover:text-zinc-800">
                ✕
              </button>
            </div>
            
            <div
              className="flex-1 overflow-y-auto prose dark:prose-invert prose-sm max-w-none text-zinc-700 dark:text-zinc-300 p-3 border rounded-xl bg-zinc-50 dark:bg-zinc-800/50"
              dangerouslySetInnerHTML={{ __html: selectedEvent.rulesContent || "<p>Belum ada ketentuan yang dituliskan oleh panitia.</p>" }}
            />

            <div className="flex flex-col md:flex-row items-center justify-between gap-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
              <span className="text-xs text-zinc-500">Bacalah seluruh bab ketentuan sebelum mendaftar.</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowRulesModal(false)}
                  className="px-4 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAgreedTerms(true);
                    setShowRulesModal(false);
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Saya Sudah Membaca & Menyetujui
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Modal Petunjuk Pembayaran Anggota (QRIS & Bank Mandiri) */}
      {showPaymentInstructions && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3 border-zinc-200 dark:border-zinc-800">
              <h3 className="font-bold text-base text-zinc-900 dark:text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-blue-600" />
                Petunjuk Pembayaran Kejuaraan
              </h3>
              <button onClick={() => setShowPaymentInstructions(null)} className="text-zinc-500 hover:text-zinc-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Rincian Pendaftaran */}
            <div className="bg-zinc-50 dark:bg-zinc-800/50 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-zinc-500">Event Kejuaraan:</span>
                <span className="font-bold text-zinc-900 dark:text-white">{showPaymentInstructions.event.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Nama Atlet / Anggota:</span>
                <span className="font-bold text-zinc-900 dark:text-white">{member?.fullName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Kelas Pertandingan:</span>
                <span className="font-semibold text-red-700 dark:text-red-400">{showPaymentInstructions.category.name}</span>
              </div>
              <div className="border-t pt-1.5 flex justify-between items-center font-bold text-sm">
                <span>Total Biaya Pendaftaran:</span>
                <span className="text-emerald-600 dark:text-emerald-400">
                  {showPaymentInstructions.category.isFeeVisible !== false ? `Rp ${showPaymentInstructions.category.fee.toLocaleString("id-ID")}` : "Sesuai Ketentuan"}
                </span>
              </div>
            </div>

            {/* Metode Pembayaran */}
            <div className="space-y-3 pt-1">
              <h4 className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-red-600" /> Pilihan Metode Bayar
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {/* QRIS */}
                <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700 space-y-1">
                  <div className="font-bold text-zinc-900 dark:text-white flex items-center gap-1">
                    <QrCode className="w-4 h-4 text-red-600" /> QRIS INKAI Surabaya
                  </div>
                  <p className="text-[11px] text-zinc-500">Scan via GoPay, OVO, Dana, ShopeePay, BCA, Mandiri</p>
                  <div className="pt-2 text-center">
                    <div className="inline-block bg-white p-2 rounded-lg border border-zinc-300">
                      <QrCode className="w-16 h-16 text-zinc-800 mx-auto" />
                      <span className="block text-[9px] font-mono text-zinc-500 mt-1">NMID: ID1029384756</span>
                    </div>
                  </div>
                </div>

                {/* Transfer Bank */}
                <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700 space-y-1 flex flex-col justify-between">
                  <div>
                    <div className="font-bold text-zinc-900 dark:text-white">Transfer Bank Mandiri</div>
                    <p className="text-[11px] text-zinc-500 mt-0.5">No. Rekening Resmi Cabang:</p>
                    <div className="mt-2 p-2 bg-white dark:bg-zinc-900 rounded-lg border font-mono font-bold text-xs text-blue-600 dark:text-blue-400">
                      141-00-1928374-1
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-1">a.n. INKAI CABANG SURABAYA</div>
                  </div>
                  <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium pt-2">
                    *Harap kirim konfirmasi bayar ke WhatsApp Admin.
                  </div>
                </div>
              </div>
            </div>

            {/* CTA WhatsApp Confirmation */}
            <div className="pt-2 space-y-2">
              <a
                href={`https://api.whatsapp.com/send?phone=6282257203462&text=${encodeURIComponent(
                  `*KONFIRMASI PEMBAYARAN ANGGOTA KEJUARAAN*\n` +
                  `----------------------------------\n` +
                  `🏆 *Event:* ${showPaymentInstructions.event.title}\n` +
                  `👤 *Nama Atlet:* ${member?.fullName}\n` +
                  `🏅 *Kelas:* ${showPaymentInstructions.category.name}\n` +
                  `💰 *Total Biaya:* Rp ${showPaymentInstructions.category.fee.toLocaleString("id-ID")}\n\n` +
                  `Saya anggota INKAI Surabaya telah melakukan pembayaran pendaftaran kejuaraan. Mohon verifikasi pendaftaran saya. Terima kasih.`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow flex items-center justify-center gap-2 transition"
              >
                <Send className="w-4 h-4" /> Konfirmasi Pembayaran via WA (082257203462)
              </a>

              <button
                type="button"
                onClick={() => setShowPaymentInstructions(null)}
                className="w-full py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Preview Piagam */}
      {previewCertificateUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-3xl w-full p-4 space-y-3 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b pb-2 border-zinc-200 dark:border-zinc-800">
              <h3 className="font-bold text-sm text-zinc-900 dark:text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-600" /> Preview Piagam Kejuaraan
              </h3>
              <button
                onClick={() => setPreviewCertificateUrl(null)}
                className="p-1 text-zinc-500 hover:text-zinc-800 dark:hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto flex items-center justify-center min-h-[300px] bg-zinc-100 dark:bg-zinc-950 rounded-xl p-2">
              {previewCertificateUrl.endsWith(".pdf") ? (
                <iframe src={previewCertificateUrl} className="w-full h-[600px] rounded-lg" title="Piagam PDF" />
              ) : (
                <img src={previewCertificateUrl} alt="Piagam Kejuaraan" className="max-h-[70vh] object-contain rounded-lg shadow-md" />
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
              <a
                href={previewCertificateUrl}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1"
              >
                Buka Tab Baru / Download
              </a>
              <button
                onClick={() => setPreviewCertificateUrl(null)}
                className="px-4 py-2 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-xl text-xs font-bold"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
