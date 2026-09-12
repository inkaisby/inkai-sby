"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  History,
  QrCode,
  RotateCcw,
  ScanLine,
  Search,
  Sparkles,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MemberAvatarRing } from "@/components/admin/ukt/MemberAvatarRing";
import {
  BELT_RANK_OPTIONS,
  beltRingVisual,
  displayUktKyuLama,
  formatRankLabel,
  getUktTargetRank,
  shortRankLabel,
} from "@/lib/belt";
import type { UktMemberRow } from "@/lib/ukt";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allRows: UktMemberRow[];
  selectedPeriodId?: string;
  onUpdateKyuBaru: (
    registrationId: string,
    newRank: string,
    row: UktMemberRow,
    examResult?: "LULUS" | "GAGAL" | "MENGULANG",
  ) => Promise<void>;
  periodLocked?: boolean;
};

type ScanHistoryItem = {
  id: string;
  memberId: string;
  fullName: string;
  nia?: string | null;
  dojoName?: string;
  kyuLama: string;
  kyuBaru: string;
  timestamp: string;
  row: UktMemberRow;
};

// Preset Kyu utama untuk tombol cepat 1-klik (Urutan dari Kyu 9 ke DAN 1)
const QUICK_KYU_PRESETS = [
  "Putih (Kyu 9)",
  "Kuning (Kyu 8)",
  "Kuning (Kyu 7)",
  "Hijau (Kyu 6)",
  "Biru (Kyu 5)",
  "Biru (Kyu 4)",
  "Coklat (Kyu 3)",
  "Coklat (Kyu 2)",
  "Coklat (Kyu 1)",
  "Hitam (DAN 1)",
];

function playBeepSound(type: "scan" | "success" | "error" = "scan") {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === "scan") {
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } else if (type === "success") {
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.08);
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.16);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.28);
    } else {
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch {
    // Ignore audio error if not supported/blocked by browser policy
  }
}

function extractNiaFromPayload(raw: string): string {
  const text = raw.trim();
  if (!text) return "";
  if (text.includes("/v/")) {
    const part = text.split("/v/")[1];
    return part?.split("?")[0]?.trim() || text;
  }
  if (text.startsWith("INKAI:MEMBER:")) {
    return text.split("INKAI:MEMBER:")[1]?.trim() || text;
  }
  return text;
}

export function UktQrKyuScannerModal({
  open,
  onOpenChange,
  allRows,
  onUpdateKyuBaru,
  periodLocked = false,
}: Props) {
  const [scanInput, setScanInput] = useState("");
  const [selectedRow, setSelectedRow] = useState<UktMemberRow | null>(null);
  const [targetKyu, setTargetKyu] = useState<string>("");
  const [examResult, setExamResult] = useState<"LULUS" | "GAGAL" | "MENGULANG">("LULUS");
  const [saving, setSaving] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>([]);

  // Camera state
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<"environment" | "user">("environment");
  const [cameraSupported, setCameraSupported] = useState(true);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Focus input when modal opens or after save
  const focusInput = useCallback(() => {
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  }, []);

  useEffect(() => {
    if (open) {
      focusInput();
    } else {
      stopCamera();
      setSelectedRow(null);
      setScanInput("");
      setTargetKyu("");
    }
  }, [open, focusInput]);

  // Stop camera helper
  const stopCamera = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  // Find member in allRows by barcode/NIA/name
  const findMember = useCallback(
    (query: string): UktMemberRow | null => {
      const cleaned = extractNiaFromPayload(query).toLowerCase();
      if (!cleaned) return null;

      // 1. Exact NIA match
      const byNia = allRows.find(
        (r) => r.nia && r.nia.trim().toLowerCase() === cleaned,
      );
      if (byNia) return byNia;

      // 2. Registration ID or Member ID match
      const byId = allRows.find(
        (r) => r.memberId === cleaned || r.registrationId === cleaned,
      );
      if (byId) return byId;

      // 3. Name or NIA substring match
      const byPartial = allRows.find(
        (r) =>
          r.fullName.toLowerCase().includes(cleaned) ||
          (r.nia && r.nia.toLowerCase().includes(cleaned)),
      );
      return byPartial || null;
    },
    [allRows],
  );

  // Handle row selection & recommend next Kyu
  const handleSelectMember = useCallback(
    (row: UktMemberRow) => {
      setSelectedRow(row);
      const lama = displayUktKyuLama(row.kyuLama, row.kyuBaru) || row.kyuLama;
      const defaultNext =
        row.kyuBaru && row.kyuBaru.trim()
          ? row.kyuBaru
          : getUktTargetRank(lama) || "Kuning (Kyu 8)";

      setTargetKyu(formatRankLabel(defaultNext) || defaultNext);
      setExamResult("LULUS");
      if (soundEnabled) playBeepSound("scan");
    },
    [soundEnabled],
  );

  // Process input text scan/search
  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!scanInput.trim()) return;

    const found = findMember(scanInput);
    if (found) {
      handleSelectMember(found);
      toast.success(`Ditemukan: ${found.fullName}`);
    } else {
      if (soundEnabled) playBeepSound("error");
      toast.error(`Peserta dengan NIA/kode "${scanInput}" tidak ditemukan dalam daftar UKT`);
    }
  };

  // Live Camera QR Scan Loop
  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraSupported(false);
        toast.error("Perangkat ini tidak mendukung kamera web");
        return;
      }

      stopCamera();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: cameraFacing, width: { ideal: 1280 }, height: { ideal: 720 } },
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
        scanVideoFrame();
      }
    } catch (err) {
      console.error("Camera error:", err);
      toast.error("Tidak dapat mengakses kamera. Pastikan izin kamera diberikan.");
      setCameraActive(false);
    }
  };

  const scanVideoFrame = () => {
    if (!videoRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
      animFrameRef.current = requestAnimationFrame(scanVideoFrame);
      return;
    }

    // Check BarcodeDetector API support
    if ("BarcodeDetector" in window) {
      const BarcodeDetectorClass = (window as unknown as { BarcodeDetector: new (opts: { formats: string[] }) => { detect: (src: ImageBitmapSource) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector;
      const detector = new BarcodeDetectorClass({ formats: ["qr_code", "code_128", "code_39", "ean_13"] });

      detector
        .detect(videoRef.current)
        .then((barcodes) => {
          if (barcodes.length > 0 && barcodes[0].rawValue) {
            const raw = barcodes[0].rawValue;
            const found = findMember(raw);
            if (found) {
              setScanInput(raw);
              handleSelectMember(found);
              toast.success(`Scan Berhasil: ${found.fullName}`);
              stopCamera();
              return;
            }
          }
          animFrameRef.current = requestAnimationFrame(scanVideoFrame);
        })
        .catch(() => {
          animFrameRef.current = requestAnimationFrame(scanVideoFrame);
        });
    } else {
      // Fallback: draw frame to hidden canvas
      animFrameRef.current = requestAnimationFrame(scanVideoFrame);
    }
  };

  // Submit/Save Kyu Baru
  const handleSave = async () => {
    if (!selectedRow) return;
    if (!selectedRow.registrationId) {
      toast.error("Peserta ini belum terdaftar di periode UKT ini");
      return;
    }
    if (!targetKyu) {
      toast.error("Pilih Kyu Baru terlebih dahulu");
      return;
    }

    setSaving(true);
    try {
      await onUpdateKyuBaru(selectedRow.registrationId, targetKyu, selectedRow, examResult);
      if (soundEnabled) playBeepSound("success");
      const savedKyuBaru = formatRankLabel(targetKyu) || targetKyu;
      toast.success(`Kyu Baru ${selectedRow.fullName} disimpan: ${savedKyuBaru}`);
      
      const now = new Date();
      const timeStr = now.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

      setScanHistory((prev) => [
        {
          id: `${selectedRow.memberId}-${Date.now()}`,
          memberId: selectedRow.memberId,
          fullName: selectedRow.fullName,
          nia: selectedRow.nia,
          dojoName: selectedRow.dojoName,
          kyuLama: kyuLamaDisplay,
          kyuBaru: savedKyuBaru,
          timestamp: timeStr,
          row: { ...selectedRow, kyuBaru: savedKyuBaru },
        },
        ...prev,
      ]);

      // Reset for next scan
      setSelectedRow(null);
      setScanInput("");
      setTargetKyu("");
      focusInput();
    } catch (err) {
      if (soundEnabled) playBeepSound("error");
      toast.error(err instanceof Error ? err.message : "Gagal memperbarui Kyu Baru");
    } finally {
      setSaving(false);
    }
  };

  // Jump Kyu helpers (+1 Kyu, +2 Kyu, +3 Kyu)
  const applyJumpKyu = (steps: number) => {
    if (!selectedRow) return;
    const lama = displayUktKyuLama(selectedRow.kyuLama, selectedRow.kyuBaru) || selectedRow.kyuLama;
    const currentIdx = QUICK_KYU_PRESETS.findIndex(
      (opt) => formatRankLabel(opt).toLowerCase() === formatRankLabel(lama).toLowerCase(),
    );

    let nextIdx = currentIdx >= 0 ? currentIdx + steps : steps;
    if (nextIdx >= QUICK_KYU_PRESETS.length) nextIdx = QUICK_KYU_PRESETS.length - 1;
    if (nextIdx < 0) nextIdx = 0;

    setTargetKyu(QUICK_KYU_PRESETS[nextIdx]);
  };

  const kyuLamaDisplay = selectedRow
    ? displayUktKyuLama(selectedRow.kyuLama, selectedRow.kyuBaru) || selectedRow.kyuLama || "Putih (Kyu 10)"
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="space-y-1">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Zap className="h-5 w-5 text-amber-500 fill-amber-500 animate-pulse" />
              Scan QR / Barcode — Express Kyu Baru
            </DialogTitle>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setSoundEnabled((v) => !v)}
              title={soundEnabled ? "Suara Aktif" : "Suara Senyap"}
            >
              {soundEnabled ? (
                <Volume2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <VolumeX className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </div>
          <DialogDescription className="text-xs sm:text-sm">
            Tembakkan alat scanner barcode USB/Bluetooth atau gunakan kamera ke Kartu Anggota untuk mengunggah Kyu Baru secara instan.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Scanner Input & Camera Controls */}
          <form onSubmit={handleSearchSubmit} className="space-y-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <ScanLine className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-amber-500" />
                <Input
                  ref={inputRef}
                  value={scanInput}
                  onChange={(e) => {
                    setScanInput(e.target.value);
                    const found = findMember(e.target.value);
                    if (found) handleSelectMember(found);
                  }}
                  placeholder="Scan QR / Tembak Barcode / Ketik NIA / Nama Peserta…"
                  className="pl-10 pr-10 text-base font-medium h-11 border-2 border-amber-400/60 focus-visible:ring-amber-500 bg-amber-50/30 dark:bg-amber-950/10"
                />
                {scanInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setScanInput("");
                      setSelectedRow(null);
                      focusInput();
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <Button
                type="submit"
                variant="default"
                className="h-11 px-4 font-semibold"
              >
                <Search className="mr-1.5 h-4 w-4" />
                Cari
              </Button>

              <Button
                type="button"
                variant={cameraActive ? "destructive" : "outline"}
                className="h-11 px-3"
                onClick={cameraActive ? stopCamera : startCamera}
                title="Buka Kamera HP/Laptop"
              >
                <Camera className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden sm:inline">
                  {cameraActive ? "Tutup Kamera" : "Kamera"}
                </span>
              </Button>
            </div>

            <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
              <span>Alat Barcode USB/Bluetooth: Standby siap scan langsung</span>
              {periodLocked && (
                <span className="text-amber-600 font-semibold">
                  ⚠️ Periode ini dikunci (Read Only)
                </span>
              )}
            </div>
          </form>

          {/* Live Camera Feed */}
          {cameraActive && (
            <div className="relative overflow-hidden rounded-xl border-2 border-emerald-500/80 bg-black aspect-video max-h-56 flex items-center justify-center">
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 pointer-events-none border-2 border-dashed border-emerald-400/80 rounded-lg m-6 animate-pulse flex items-center justify-center">
                <span className="bg-black/60 text-emerald-400 text-xs px-2 py-1 rounded">
                  Arahkan Kode QR Ke Sini
                </span>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="absolute bottom-2 right-2 text-xs h-7"
                onClick={() => {
                  setCameraFacing((f) => (f === "environment" ? "user" : "environment"));
                  startCamera();
                }}
              >
                <RotateCcw className="mr-1 h-3 w-3" /> Ganti Kamera
              </Button>
            </div>
          )}

          {/* Selected Member Display Card */}
          {selectedRow ? (
            <div className="rounded-xl border-2 border-emerald-500/40 bg-card p-4 space-y-4 shadow-sm">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-border/50">
                <div className="flex items-center gap-3">
                  <MemberAvatarRing
                    fullName={selectedRow.fullName}
                    photoUrl={selectedRow.photoUrl}
                    currentRank={kyuLamaDisplay}
                    size="lg"
                  />
                  <div>
                    <h3 className="font-bold text-lg leading-tight uppercase tracking-wide">
                      {selectedRow.fullName}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">
                        NIA: {selectedRow.nia || "—"}
                      </span>
                      <span>•</span>
                      <span>Dojo: {selectedRow.dojoName || "—"}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <Badge variant="outline" className="text-xs px-2 py-1 font-medium bg-muted">
                    Kyu Lama:{" "}
                    <span className="font-bold text-foreground ml-1">
                      {shortRankLabel(kyuLamaDisplay)}
                    </span>
                  </Badge>
                  {selectedRow.kyuBaru && (
                    <Badge className="bg-emerald-600 text-white text-xs px-2 py-1">
                      Terisi: {shortRankLabel(selectedRow.kyuBaru)}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Fast Kyu Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="font-bold text-sm text-foreground flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-emerald-500" />
                    Pilih Kyu Baru (Target UKT):
                  </Label>
                  {/* Jump Shortcuts */}
                  <div className="flex items-center gap-1 text-xs">
                    <span className="text-muted-foreground mr-1">Lompat:</span>
                    <button
                      type="button"
                      onClick={() => applyJumpKyu(1)}
                      className="px-2 py-0.5 rounded bg-muted hover:bg-muted/80 font-medium text-[11px]"
                    >
                      +1 Kyu
                    </button>
                    <button
                      type="button"
                      onClick={() => applyJumpKyu(2)}
                      className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-semibold text-[11px]"
                    >
                      +2 Kyu
                    </button>
                    <button
                      type="button"
                      onClick={() => applyJumpKyu(3)}
                      className="px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-semibold text-[11px]"
                    >
                      +3 Kyu
                    </button>
                  </div>
                </div>

                {/* Preset Buttons Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 pt-1">
                  {QUICK_KYU_PRESETS.map((preset) => {
                    const isSelected =
                      formatRankLabel(targetKyu).toLowerCase() ===
                      formatRankLabel(preset).toLowerCase();
                    const shortName = shortRankLabel(preset);
                    const visual = beltRingVisual(preset);

                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setTargetKyu(preset)}
                        className={cn(
                          "flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold border transition-all",
                          isSelected
                            ? "border-emerald-600 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200 ring-2 ring-emerald-500 shadow-sm"
                            : "border-border/60 bg-muted/30 hover:bg-muted text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0 border border-black/20"
                          style={{ backgroundColor: visual.bg }}
                        />
                        <span>{shortName}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Dropdown Custom Rank */}
                <div className="pt-2 flex items-center gap-2">
                  <span className="text-xs text-muted-foreground shrink-0">
                    Opsi Lain:
                  </span>
                  <Select value={targetKyu} onValueChange={setTargetKyu}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Pilih semua sabuk…" />
                    </SelectTrigger>
                    <SelectContent>
                      {BELT_RANK_OPTIONS.map((opt) => (
                        <SelectItem key={opt} value={opt} className="text-xs">
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSelectedRow(null);
                    setScanInput("");
                    focusInput();
                  }}
                  className="w-full sm:w-auto h-11"
                >
                  Batal / Ganti
                </Button>

                <Button
                  type="button"
                  disabled={saving || periodLocked || !targetKyu}
                  onClick={handleSave}
                  className="w-full flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md"
                >
                  {saving ? (
                    "Menyimpan Kyu Baru…"
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-5 w-5" />
                      Simpan {formatRankLabel(targetKyu) || targetKyu} & Scan Berikutnya (Enter)
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            /* Empty Search Prompt */
            <div className="rounded-xl border border-dashed border-border/80 p-8 text-center space-y-3 bg-muted/10">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-600">
                <QrCode className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-sm">
                  Siap Melakukan Scan / Pencarian Peserta UKT
                </p>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  Arahkan alat scanner USB ke barcode kartu anggota, atau gunakan kolom di atas untuk mencari nama / NIA.
                </p>
              </div>
            </div>
          )}

          {/* Session Scan History Log */}
          {scanHistory.length > 0 && (
            <div className="space-y-2 pt-3 border-t border-border/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-emerald-600" />
                  <h4 className="font-bold text-xs sm:text-sm">
                    Riwayat Scan & Update Sesi Ini
                  </h4>
                  <Badge
                    variant="secondary"
                    className="text-[11px] px-1.5 py-0 font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  >
                    {scanHistory.length} Peserta
                  </Badge>
                </div>
                <button
                  type="button"
                  onClick={() => setScanHistory([])}
                  className="text-[11px] text-muted-foreground hover:text-foreground underline"
                >
                  Bersihkan Log
                </button>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 divide-y divide-border/40 border rounded-lg bg-muted/20 p-2">
                {scanHistory.map((item) => (
                  <div
                    key={item.id}
                    className="pt-1.5 first:pt-0 flex items-center justify-between text-xs gap-2"
                  >
                    <div className="min-w-0 flex-1 flex items-center gap-2">
                      <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                        {item.timestamp}
                      </span>
                      <span className="font-bold uppercase truncate">
                        {item.fullName}
                      </span>
                      {item.nia && (
                        <span className="text-muted-foreground text-[10px] hidden sm:inline">
                          ({item.nia})
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] text-muted-foreground">
                        {shortRankLabel(item.kyuLama)}
                      </span>
                      <ArrowRight className="h-3 w-3 text-emerald-600" />
                      <Badge className="bg-emerald-600 text-white text-[10px] px-1.5 py-0.5 font-bold">
                        {shortRankLabel(item.kyuBaru)}
                      </Badge>

                      <button
                        type="button"
                        onClick={() => handleSelectMember(item.row)}
                        className="text-[11px] text-amber-600 hover:underline font-medium ml-1"
                        title="Edit / ubah kembali kyu peserta ini"
                      >
                        Ubah
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
