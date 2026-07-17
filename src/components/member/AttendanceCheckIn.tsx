"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { showError, showSuccess } from "@/lib/client-toast";
import { Loader2, MapPin } from "lucide-react";

export function AttendanceCheckIn({
  defaultDojoId,
}: {
  defaultDojoId?: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [qrPayload, setQrPayload] = useState("");

  async function checkIn() {
    setLoading(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error("Perangkat tidak mendukung lokasi"));
          return;
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
        });
      });

      const res = await fetch("/api/member/attendance/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          method: qrPayload.trim() ? "QR_SCAN" : "GPS",
          qrPayload: qrPayload.trim() || undefined,
          dojoId: defaultDojoId || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showError(data.error || "Gagal absen");
        return;
      }
      showSuccess(data.message || "Absensi berhasil");
      setQrPayload("");
      router.refresh();
    } catch (error) {
      const message =
        error instanceof GeolocationPositionError
          ? "Izinkan akses lokasi untuk absensi"
          : error instanceof Error
            ? error.message
            : "Gagal membaca lokasi";
      showError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mb-6 rounded-2xl border border-border/60 bg-card p-4">
      <h3 className="mb-1 font-semibold">Absen sekarang</h3>
      <p className="mb-3 text-sm text-muted-foreground">
        Gunakan lokasi perangkat di area dojo. Opsional: tempel kode QR dojo
        jika tersedia.
      </p>
      <div className="mb-3 space-y-1.5">
        <Label htmlFor="qr-payload">Kode QR dojo (opsional)</Label>
        <Input
          id="qr-payload"
          value={qrPayload}
          onChange={(e) => setQrPayload(e.target.value)}
          placeholder="Tempel hasil scan / kode dojo"
        />
      </div>
      <Button
        type="button"
        className="w-full gap-2 bg-inkai-red hover:bg-inkai-red/90 sm:w-auto"
        disabled={loading}
        onClick={() => void checkIn()}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <MapPin className="h-4 w-4" />
        )}
        Absen dengan lokasi
      </Button>
    </div>
  );
}
