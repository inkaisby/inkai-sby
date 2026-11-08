"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Trophy,
  Scale,
  Award,
  Users,
  ExternalLink,
  CheckCircle2,
  Loader2,
  Calendar,
  Layers,
  Archive,
  ArrowRight,
  UserCheck,
  Search,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatMemberName, formatRankLabel } from "@/lib/belt";
import type { AdminMemberRow } from "@/lib/inkai-api/admin-data";
import type { ActiveRegistrationPeriod } from "@/lib/active-registration-periods";
import type { EventRegistrationKind } from "@/lib/event-quick-register";
import { registerMemberToEvent } from "@/lib/event-quick-register";
import { showError, showSuccess } from "@/lib/client-toast";

export type EventType = "pertandingan" | "wasit-juri" | "ukt" | "latber";

type TournamentCategory = {
  id: string;
  name: string;
  categoryType: string;
  gender: string;
  minAge?: number | null;
  maxAge?: number | null;
  fee?: number;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventType: EventType | null;
  activeUkt: ActiveRegistrationPeriod;
  activeLatber: ActiveRegistrationPeriod;
  activePertandingan: ActiveRegistrationPeriod;
  activeWasitJuri: ActiveRegistrationPeriod;
  selectedIds: string[];
  members: AdminMemberRow[];
  canRegister?: boolean;
  onSuccessRegistration?: (memberId: string, kind: EventRegistrationKind) => void;
  onClearSelection?: () => void;
};

export function AnggotaEventModal({
  open,
  onOpenChange,
  eventType,
  activeUkt,
  activeLatber,
  activePertandingan,
  activeWasitJuri,
  selectedIds,
  members,
  canRegister = true,
  onSuccessRegistration,
  onClearSelection,
}: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [searchMemberQuery, setSearchMemberQuery] = useState("");
  const [tournamentCategories, setTournamentCategories] = useState<TournamentCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [loadingCategories, setLoadingCategories] = useState(false);
  
  // Opsi form Wasit Juri
  const [wasitTargetGrade, setWasitTargetGrade] = useState<"JURI_B" | "JURI_A" | "WASIT_B" | "WASIT_A">("JURI_B");
  const [wasitSubmissionType, setWasitSubmissionType] = useState<"BARU" | "KENAIKAN" | "REFRESHING">("BARU");
  const [wasitDiscipline, setWasitDiscipline] = useState<"KATA_KUMITE" | "KUMITE" | "KATA">("KATA_KUMITE");

  // Reset saat modal ditutup
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSearchMemberQuery("");
      setSelectedCategoryId("");
    }
    onOpenChange(nextOpen);
  };

  // Muat kategori pertandingan jika event pertandingan aktif
  useEffect(() => {
    if (!open || eventType !== "pertandingan" || !activePertandingan?.id) {
      return;
    }

    let ignore = false;
    fetch(`/api/admin/pertandingan/categories?eventId=${encodeURIComponent(activePertandingan.id)}`)
      .then((res) => res.json())
      .then((data) => {
        if (ignore) return;
        if (Array.isArray(data.categories)) {
          setTournamentCategories(data.categories);
          if (data.categories.length > 0) {
            setSelectedCategoryId(data.categories[0].id);
          }
        }
      })
      .catch(() => {
        /* ignore error */
      })
      .finally(() => {
        if (!ignore) setLoadingCategories(false);
      });

    return () => {
      ignore = true;
    };
  }, [open, eventType, activePertandingan?.id]);

  // Dapatkan detail anggota yang dipilih di tabel
  const selectedMembers = useMemo(() => {
    if (selectedIds.length === 0) return [];
    const idSet = new Set(selectedIds);
    return members.filter((m) => idSet.has(m.id));
  }, [selectedIds, members]);

  // Filter anggota untuk pencarian satuan
  const searchResults = useMemo(() => {
    if (!searchMemberQuery.trim()) return [];
    const q = searchMemberQuery.toLowerCase().trim();
    return members
      .filter((m) => {
        const name = (m.fullName || "").toLowerCase();
        const nia = (m.nia || "").toLowerCase();
        return name.includes(q) || nia.includes(q);
      })
      .slice(0, 6);
  }, [searchMemberQuery, members]);

  if (!eventType) return null;

  const activePeriod =
    eventType === "ukt"
      ? activeUkt
      : eventType === "latber"
      ? activeLatber
      : eventType === "pertandingan"
      ? activePertandingan
      : activeWasitJuri;

  const eventMeta = {
    pertandingan: {
      title: "Kejuaraan & Pertandingan",
      subtitle: "Pendaftaran kontingen atlet, kategori kelas tanding, dan arsip kejuaraan.",
      icon: Trophy,
      badgeColor: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-300",
      mainHref: "/admin/pertandingan",
      subLinks: [
        { label: "Pendaftaran & Roster", href: "/admin/pertandingan", icon: UserCheck },
        { label: "Kategori Kelas", href: "/admin/pertandingan/kategori", icon: Layers },
        { label: "Arsip Kejuaraan", href: "/admin/pertandingan/arsip", icon: Archive },
      ],
    },
    "wasit-juri": {
      title: "Sertifikasi Wasit & Juri",
      subtitle: "Ujian lisensi, kenaikan grade, dan refreshing wasit juri sabuk hitam.",
      icon: Scale,
      badgeColor: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-300",
      mainHref: "/admin/sertifikasi-wasit-juri",
      subLinks: [
        { label: "Kelola Pendaftaran & Peserta", href: "/admin/sertifikasi-wasit-juri", icon: UserCheck },
        { label: "Arsip Sertifikasi", href: "/admin/sertifikasi-wasit-juri?view=arsip", icon: Archive },
      ],
    },
    ukt: {
      title: "UKT (Ujian Kenaikan Tingkat)",
      subtitle: "Pendaftaran ujian sabuk kyu/DAN, verifikasi berkas, dan penerbitan nomor nota.",
      icon: Award,
      badgeColor: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-300",
      mainHref: "/admin/ukt",
      subLinks: [
        { label: "Pendaftaran & Rekap UKT", href: "/admin/ukt", icon: UserCheck },
        { label: "Arsip Periode UKT", href: "/admin/ukt/arsip", icon: Archive },
      ],
    },
    latber: {
      title: "Latihan Bersama (Latber)",
      subtitle: "Pendaftaran sesi latihan gabungan antar-ranting dan pemusatan latihan cabang.",
      icon: Users,
      badgeColor: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-300",
      mainHref: "/admin/latber",
      subLinks: [
        { label: "Pendaftaran Latihan Bersama", href: "/admin/latber", icon: UserCheck },
        { label: "Arsip Latihan Bersama", href: "/admin/latber/arsip", icon: Archive },
      ],
    },
  }[eventType];

  const IconComponent = eventMeta.icon;

  // Handler Pendaftaran Massal
  const handleBulkRegister = async () => {
    if (!activePeriod?.id) {
      showError("Tidak ada periode event yang sedang aktif.");
      return;
    }
    if (selectedIds.length === 0) {
      showError("Pilih minimal satu anggota di tabel terlebih dahulu.");
      return;
    }

    setSubmitting(true);
    let successCount = 0;
    let alreadyCount = 0;
    let failCount = 0;

    try {
      if (eventType === "ukt" || eventType === "latber") {
        for (const memberId of selectedIds) {
          const res = await registerMemberToEvent(memberId, eventType, activePeriod.id);
          if (res.ok) {
            successCount++;
            onSuccessRegistration?.(memberId, eventType);
          } else if (res.alreadyRegistered) {
            alreadyCount++;
          } else {
            failCount++;
          }
        }
      } else if (eventType === "pertandingan") {
        if (!selectedCategoryId) {
          showError("Pilih kategori kelas pertandingan terlebih dahulu.");
          setSubmitting(false);
          return;
        }

        const entries = selectedIds.map((memberId) => ({
          memberId,
          categoryId: selectedCategoryId,
        }));

        const res = await fetch("/api/admin/pertandingan/registrations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventId: activePeriod.id,
            entries,
          }),
        });

        if (res.ok) {
          successCount = selectedIds.length;
        } else {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Gagal mendaftarkan peserta pertandingan.");
        }
      } else if (eventType === "wasit-juri") {
        for (const memberId of selectedIds) {
          const res = await fetch("/api/admin/sertifikasi-wasit-juri/registrations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              periodId: activePeriod.id,
              memberId,
              targetGrade: wasitTargetGrade,
              submissionType: wasitSubmissionType,
              discipline: wasitDiscipline,
            }),
          });
          if (res.ok) {
            successCount++;
          } else {
            const errData = await res.json().catch(() => ({}));
            if (/sudah terdaftar/i.test(errData.error || "")) {
              alreadyCount++;
            } else {
              failCount++;
            }
          }
        }
      }

      if (successCount > 0) {
        showSuccess(`Berhasil mendaftarkan ${successCount} anggota ke ${eventMeta.title}.`);
        onClearSelection?.();
        onOpenChange(false);
      } else if (alreadyCount > 0 && failCount === 0) {
        showError(`Semua anggota terpilih (${alreadyCount}) sudah terdaftar di kegiatan ini.`);
      } else {
        showError(`Pendaftaran selesai: ${successCount} berhasil, ${alreadyCount} sudah terdaftar, ${failCount} gagal.`);
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : "Terjadi kesalahan saat memproses pendaftaran.");
    } finally {
      setSubmitting(false);
    }
  };

  // Handler Pendaftaran Satuan
  const handleSingleRegister = async (memberId: string) => {
    if (!activePeriod?.id) {
      showError("Tidak ada periode event yang sedang aktif.");
      return;
    }

    setSubmitting(true);
    try {
      if (eventType === "ukt" || eventType === "latber") {
        const res = await registerMemberToEvent(memberId, eventType, activePeriod.id);
        if (res.ok) {
          showSuccess(`Anggota berhasil didaftarkan ke ${eventMeta.title}.`);
          onSuccessRegistration?.(memberId, eventType);
          setSearchMemberQuery("");
        } else {
          showError(res.error || "Gagal mendaftar ke kegiatan.");
        }
      } else if (eventType === "pertandingan") {
        if (!selectedCategoryId) {
          showError("Pilih kategori kelas pertandingan terlebih dahulu.");
          setSubmitting(false);
          return;
        }

        const res = await fetch("/api/admin/pertandingan/registrations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventId: activePeriod.id,
            entries: [{ memberId, categoryId: selectedCategoryId }],
          }),
        });

        if (res.ok) {
          showSuccess(`Anggota berhasil didaftarkan ke ${eventMeta.title}.`);
          setSearchMemberQuery("");
        } else {
          const errData = await res.json().catch(() => ({}));
          showError(errData.error || "Gagal mendaftar.");
        }
      } else if (eventType === "wasit-juri") {
        const res = await fetch("/api/admin/sertifikasi-wasit-juri/registrations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            periodId: activePeriod.id,
            memberId,
            targetGrade: wasitTargetGrade,
            submissionType: wasitSubmissionType,
            discipline: wasitDiscipline,
          }),
        });
        if (res.ok) {
          showSuccess(`Anggota berhasil didaftarkan ke ${eventMeta.title}.`);
          setSearchMemberQuery("");
        } else {
          const errData = await res.json().catch(() => ({}));
          showError(errData.error || "Gagal mendaftar.");
        }
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : "Gagal mendaftar.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-5 sm:p-6">
        <DialogHeader className="border-b pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-muted/60">
                <IconComponent className="h-5 w-5 text-foreground" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">
                  {eventMeta.title}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  {eventMeta.subtitle}
                </DialogDescription>
              </div>
            </div>

            {activePeriod?.id ? (
              <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 gap-1 text-xs shrink-0">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                Pendaftaran Buka
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground gap-1 text-xs shrink-0">
                Tutup / Arsip
              </Badge>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Ringkasan Periode Aktif */}
          <div className="rounded-lg border bg-muted/30 p-3.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
              <span className="font-semibold uppercase tracking-wider text-[11px] text-foreground flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                Periode Terkini
              </span>
              <Link
                href={eventMeta.mainHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline text-xs"
              >
                Buka Halaman Penuh <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
            {activePeriod?.id ? (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {activePeriod.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    ID Kegiatan: <code className="text-[11px] font-mono">{activePeriod.id}</code>
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Tidak ada periode pendaftaran yang sedang dibuka saat ini. Anda dapat membuat jadwal baru atau melihat riwayat kegiatan di modul arsip.
              </p>
            )}
          </div>

          {/* Bagian Pendaftaran Anggota (Quick / Bulk) */}
          {canRegister && activePeriod?.id ? (
            <div className="rounded-lg border p-4 space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <UserCheck className="h-3.5 w-3.5 text-primary" />
                Pendaftaran Cepat Anggota
              </h3>

              {/* Skenario 1: Ada Anggota Terpilih di Tabel (Bulk) */}
              {selectedIds.length > 0 ? (
                <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-3.5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">
                      Terdapat <strong className="text-primary">{selectedIds.length}</strong> anggota terpilih di tabel
                    </p>
                    {onClearSelection ? (
                      <button
                        type="button"
                        onClick={onClearSelection}
                        className="text-xs text-muted-foreground hover:text-foreground underline"
                      >
                        Batalkan pilihan
                      </button>
                    ) : null}
                  </div>

                  {/* Cuplikan Nama Anggota */}
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto py-1">
                    {selectedMembers.slice(0, 6).map((m) => (
                      <span
                        key={m.id}
                        className="inline-flex items-center gap-1 rounded border bg-background px-2 py-0.5 text-xs text-foreground"
                      >
                        {formatMemberName(m.fullName)}
                        <span className="text-[10px] text-muted-foreground">
                          ({formatRankLabel(m.currentRank) || "Kyu"})
                        </span>
                      </span>
                    ))}
                    {selectedMembers.length > 6 ? (
                      <span className="inline-flex items-center rounded border bg-background/50 px-2 py-0.5 text-xs text-muted-foreground">
                        +{selectedMembers.length - 6} lainnya
                      </span>
                    ) : null}
                  </div>

                  {/* Opsi khusus Pertandingan */}
                  {eventType === "pertandingan" ? (
                    <div className="space-y-1.5 pt-1">
                      <label className="text-xs font-medium text-foreground">
                        Kategori Kelas Tanding:
                      </label>
                      {loadingCategories ? (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Memuat kategori...
                        </div>
                      ) : tournamentCategories.length > 0 ? (
                        <select
                          value={selectedCategoryId}
                          onChange={(e) => setSelectedCategoryId(e.target.value)}
                          className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground"
                        >
                          {tournamentCategories.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.name} ({cat.categoryType} · {cat.gender})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          Belum ada kategori kelas di kejuaraan ini. Buat kategori terlebih dahulu di menu Kategori Kelas.
                        </p>
                      )}
                    </div>
                  ) : null}

                  {/* Opsi khusus Wasit Juri */}
                  {eventType === "wasit-juri" ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
                      <div>
                        <label className="block text-muted-foreground mb-1">Target Grade:</label>
                        <select
                          value={wasitTargetGrade}
                          onChange={(e) => setWasitTargetGrade(e.target.value as "JURI_B" | "JURI_A" | "WASIT_B" | "WASIT_A")}
                          className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                        >
                          <option value="JURI_B">Juri B</option>
                          <option value="JURI_A">Juri A</option>
                          <option value="WASIT_B">Wasit B</option>
                          <option value="WASIT_A">Wasit A</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-muted-foreground mb-1">Jenis Pengajuan:</label>
                        <select
                          value={wasitSubmissionType}
                          onChange={(e) => setWasitSubmissionType(e.target.value as "BARU" | "KENAIKAN" | "REFRESHING")}
                          className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                        >
                          <option value="BARU">Baru</option>
                          <option value="KENAIKAN">Kenaikan</option>
                          <option value="REFRESHING">Refreshing</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-muted-foreground mb-1">Disiplin:</label>
                        <select
                          value={wasitDiscipline}
                          onChange={(e) => setWasitDiscipline(e.target.value as "KATA_KUMITE" | "KUMITE" | "KATA")}
                          className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                        >
                          <option value="KATA_KUMITE">Kata & Kumite</option>
                          <option value="KUMITE">Kumite</option>
                          <option value="KATA">Kata</option>
                        </select>
                      </div>
                    </div>
                  ) : null}

                  <Button
                    type="button"
                    onClick={handleBulkRegister}
                    disabled={submitting}
                    className="w-full h-9 text-xs font-semibold gap-1.5"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Memproses Pendaftaran...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Daftarkan {selectedIds.length} Anggota ke {eventMeta.title}
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                /* Skenario 2: Cari Anggota Satuan */
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Cari nama atau NIA anggota di halaman ini..."
                      value={searchMemberQuery}
                      onChange={(e) => setSearchMemberQuery(e.target.value)}
                      className="pl-8 h-8 text-xs"
                    />
                  </div>

                  {searchResults.length > 0 ? (
                    <div className="border rounded-md divide-y max-h-40 overflow-y-auto">
                      {searchResults.map((m) => (
                        <div
                          key={m.id}
                          className="flex items-center justify-between p-2 text-xs hover:bg-muted/50"
                        >
                          <div>
                            <p className="font-medium text-foreground">
                              {formatMemberName(m.fullName)}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              NIA: {m.nia || "—"} · {formatRankLabel(m.currentRank) || "Kyu"} · {m.dojo?.name || "Ranting"}
                            </p>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={submitting}
                            onClick={() => handleSingleRegister(m.id)}
                            className="h-7 text-[11px] px-2.5"
                          >
                            Daftarkan
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : searchMemberQuery.trim() ? (
                    <p className="text-xs text-muted-foreground py-1 text-center">
                      Anggota tidak ditemukan pada daftar halaman ini.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Pilih centang anggota di tabel untuk pendaftaran massal, atau ketik nama untuk mendaftarkan 1 per 1.
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : null}

          {/* Bagian Pintasan Sub-Menu (Mirroring Sidebar) */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Pintasan Menu ({eventMeta.title})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {eventMeta.subLinks.map((link) => {
                const SubIcon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center justify-between rounded-lg border p-2.5 hover:bg-muted/60 transition-colors group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-md border bg-background group-hover:border-primary/50">
                        <SubIcon className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary" />
                      </div>
                      <span className="text-xs font-medium text-foreground">
                        {link.label}
                      </span>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
