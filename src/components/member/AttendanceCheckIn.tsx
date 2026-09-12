"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { showError, showSuccess } from "@/lib/client-toast";
import { parseDojoQrPayload } from "@/lib/attendance-geofence";
import { DojoQrModal } from "@/components/admin/pengaturan/DojoQrModal";
import {
  Camera,
  Fingerprint,
  Loader2,
  MapPin,
  QrCode,
  RefreshCw,
  X,
} from "lucide-react";

function bufferToBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBuffer(s: string): ArrayBuffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const str = atob(b64);
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
  return bytes.buffer;
}

type LocationOption = { id: string; name: string };
type EventOption = { id: string; title: string; hostDojoId?: string };

export function AttendanceCheckIn({
  defaultDojoId,
  homeDojoName,
}: {
  defaultDojoId?: string | null;
  homeDojoName?: string | null;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrPayload, setQrPayload] = useState("");
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [dojos, setDojos] = useState<LocationOption[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [selectedDojoId, setSelectedDojoId] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [bioSupported, setBioSupported] = useState(false);
  const [bioRegistered, setBioRegistered] = useState(false);
  const [bioBusy, setBioBusy] = useState(false);

  // Camera Scanner States
  const [scanOpen, setScanOpen] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanLoopRef = useRef<number | null>(null);

  // Dojo QR Modal View state
  const [myDojoQrOpen, setMyDojoQrOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.PublicKeyCredential) return;
    setBioSupported(true);
    const run = () => {
      void fetch("/api/member/attendance/webauthn/register?peek=1")
        .then((r) => r.json())
        .then((d) => setBioRegistered(Boolean(d.registered)))
        .catch(() => undefined);
    };
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(run, { timeout: 2000 });
      return () => window.cancelIdleCallback(id);
    }
    const t = window.setTimeout(run, 400);
    return () => window.clearTimeout(t);
  }, []);

  async function loadLocations() {
    setLocationsLoading(true);
    try {
      const res = await fetch("/api/member/attendance/locations");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showError(data.error || "Gagal memuat lokasi");
        return;
      }
      setDojos(Array.isArray(data.dojos) ? data.dojos : []);
      setEvents(Array.isArray(data.eventsToday) ? data.eventsToday : []);
    } finally {
      setLocationsLoading(false);
    }
  }

  async function getPosition() {
    return new Promise<GeolocationPosition>((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Perangkat tidak mendukung lokasi"));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 30000,
      });
    });
  }

  async function registerBiometric() {
    setBioBusy(true);
    try {
      const res = await fetch("/api/member/attendance/webauthn/register");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memulai biometrik");
      const opt = data.options;
      const credential = (await navigator.credentials.create({
        publicKey: {
          ...opt,
          challenge: base64UrlToBuffer(opt.challenge),
          user: {
            ...opt.user,
            id: new TextEncoder().encode(String(opt.user.id)),
          },
        },
      })) as PublicKeyCredential | null;
      if (!credential) throw new Error("Biometrik dibatalkan");
      const response = credential.response as AuthenticatorAttestationResponse;
      const save = await fetch("/api/member/attendance/webauthn/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challenge: opt.challenge,
          credentialId: bufferToBase64Url(credential.rawId),
          publicKey: bufferToBase64Url(response.getPublicKey?.() || new ArrayBuffer(0)),
          transports: response.getTransports?.() || [],
        }),
      });
      const saved = await save.json().catch(() => ({}));
      if (!save.ok) throw new Error(saved.error || "Gagal menyimpan biometrik");
      setBioRegistered(true);
      showSuccess("Absen biometrik diaktifkan");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Gagal biometrik");
    } finally {
      setBioBusy(false);
    }
  }

  async function verifyBiometric(): Promise<string | null> {
    const res = await fetch(
      "/api/member/attendance/webauthn/register?mode=auth",
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Biometrik belum aktif");
    const opt = data.options;
    const assertion = (await navigator.credentials.get({
      publicKey: {
        ...opt,
        challenge: base64UrlToBuffer(opt.challenge),
        allowCredentials: (opt.allowCredentials || []).map(
          (c: { id: string; type: string; transports?: string[] }) => ({
            ...c,
            id: base64UrlToBuffer(c.id),
          }),
        ),
      },
    })) as PublicKeyCredential | null;
    if (!assertion) throw new Error("Biometrik dibatalkan");
    const verify = await fetch("/api/member/attendance/webauthn/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        challenge: opt.challenge,
        credentialId: bufferToBase64Url(assertion.rawId),
      }),
    });
    const verified = await verify.json().catch(() => ({}));
    if (!verify.ok) throw new Error(verified.error || "Verifikasi gagal");
    return typeof verified.biometricToken === "string"
      ? verified.biometricToken
      : null;
  }

  async function checkIn(withBiometric: boolean, directQrPayload?: string) {
    setLoading(true);
    try {
      let biometricToken: string | null = null;
      if (withBiometric) {
        biometricToken = await verifyBiometric();
      }

      const pos = await getPosition();
      const activeQrPayload = (directQrPayload || qrPayload).trim();
      const extractedFromQr = activeQrPayload ? parseDojoQrPayload(activeQrPayload) : null;

      const dojoId =
        extractedFromQr ||
        selectedDojoId ||
        (selectedEventId
          ? events.find((e) => e.id === selectedEventId)?.hostDojoId
          : null) ||
        undefined;

      const res = await fetch("/api/member/attendance/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          method: activeQrPayload ? "QR_SCAN" : "GPS",
          qrPayload: activeQrPayload || undefined,
          dojoId: dojoId || undefined,
          eventId: selectedEventId || undefined,
          biometricToken: biometricToken || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showError(data.error || "Gagal absen");
        return;
      }
      showSuccess(data.message || "Absensi berhasil");
      setQrPayload("");
      setSelectedDojoId(null);
      setSelectedEventId(null);
      setOverrideOpen(false);
      startTransition(() => {
        router.refresh();
      });
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

  // Camera Barcode Scanner Functions
  function stopScan() {
    if (scanLoopRef.current != null) {
      cancelAnimationFrame(scanLoopRef.current);
      scanLoopRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setScanOpen(false);
    setScanError(null);
  }

  async function startScan(targetFacingMode: "environment" | "user" = facingMode) {
    setScanError(null);
    setScanOpen(true);
    setFacingMode(targetFacingMode);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: targetFacingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();

      if (window.BarcodeDetector) {
        const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
        const tick = async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) {
            scanLoopRef.current = requestAnimationFrame(() => void tick());
            return;
          }
          try {
            const codes = await detector.detect(videoRef.current);
            const raw = codes[0]?.rawValue;
            if (raw) {
              handleQrDetected(raw);
              return;
            }
          } catch {
            /* loop continues */
          }
          scanLoopRef.current = requestAnimationFrame(() => void tick());
        };
        scanLoopRef.current = requestAnimationFrame(() => void tick());
      } else {
        setScanError("Browser ini tidak mendukung pembacaan otomatis via BarcodeDetector. Tempel kode QR secara manual.");
      }
    } catch (e) {
      console.error("[Camera error]", e);
      setScanError("Tidak dapat mengakses kamera. Pastikan izin kamera aktif pada browser.");
    }
  }

  function handleQrDetected(raw: string) {
    if (typeof window !== "undefined" && window.navigator?.vibrate) {
      window.navigator.vibrate([100, 50, 100]);
    }
    stopScan();
    const dojoIdExtracted = parseDojoQrPayload(raw);
    showSuccess("Kode QR Dojo terdeteksi! Melakukan absensi...");
    setQrPayload(raw);
    void checkIn(false, raw);
  }

  useEffect(() => {
    return () => stopScan();
  }, []);

  return (
    <div className="mb-6 rounded-2xl border border-border/60 bg-card p-4">
      <h3 className="mb-1 font-semibold flex items-center gap-2">
        <MapPin className="h-4 w-4 text-inkai-red" />
        Absen Sekarang
      </h3>
      <p className="mb-1 text-sm text-muted-foreground">
        {homeDojoName
          ? `Dojo Anda: ${homeDojoName}`
          : "Gunakan lokasi perangkat atau Scan Kode QR Ranting di area dojo."}
      </p>
      <p className="mb-3 text-xs text-muted-foreground">
        GPS menentukan dojo terdekat. Kendala lokasi? Gunakan tombol <strong>Scan Kode QR Ranting</strong> atau <strong>Bukan di sini?</strong>.
      </p>

      <div className="mb-3 flex flex-wrap gap-2">
        <Button
          type="button"
          className="bg-inkai-red hover:bg-inkai-red/90 text-white text-xs gap-1.5 shadow-sm"
          size="sm"
          onClick={() => void startScan("environment")}
        >
          <Camera className="h-3.5 w-3.5" />
          Scan Kode QR Ranting
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() => {
            const next = !overrideOpen;
            setOverrideOpen(next);
            if (next && dojos.length === 0) void loadLocations();
          }}
        >
          Bukan di sini?
        </Button>

        {defaultDojoId && homeDojoName ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs gap-1 text-inkai-red hover:bg-inkai-red/10"
            onClick={() => setMyDojoQrOpen(true)}
          >
            <QrCode className="h-3.5 w-3.5" />
            Barcode Dojo Saya
          </Button>
        ) : null}

        {bioSupported && !bioRegistered ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1 text-xs"
            disabled={bioBusy}
            onClick={() => void registerBiometric()}
          >
            {bioBusy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Fingerprint className="h-3.5 w-3.5" />
            )}
            Aktifkan absen biometrik
          </Button>
        ) : null}
      </div>

      {overrideOpen ? (
        <div className="mb-3 space-y-2 rounded-xl border border-border/60 bg-muted/30 p-3">
          {locationsLoading ? (
            <p className="text-xs text-muted-foreground">Memuat lokasi…</p>
          ) : (
            <>
              <Label className="text-xs">Pilih dojo tempat latihan hari ini</Label>
              <select
                className="h-10 w-full rounded-lg border bg-background px-2 text-sm"
                value={selectedDojoId || ""}
                onChange={(e) => {
                  setSelectedDojoId(e.target.value || null);
                  setSelectedEventId(null);
                }}
              >
                <option value="">Otomatis (terdekat via GPS)</option>
                {dojos.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                    {d.id === defaultDojoId ? " (dojo saya)" : ""}
                  </option>
                ))}
              </select>
              {events.length > 0 ? (
                <>
                  <Label className="text-xs">Atau kegiatan hari ini</Label>
                  <select
                    className="h-10 w-full rounded-lg border bg-background px-2 text-sm"
                    value={selectedEventId || ""}
                    onChange={(e) => {
                      setSelectedEventId(e.target.value || null);
                      if (e.target.value) setSelectedDojoId(null);
                    }}
                  >
                    <option value="">—</option>
                    {events.map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.title}
                      </option>
                    ))}
                  </select>
                </>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      <button
        type="button"
        className="mb-3 text-xs font-semibold text-inkai-red hover:underline"
        onClick={() => setQrOpen((v) => !v)}
      >
        {qrOpen ? "Sembunyikan ketik kode QR" : "Punya kode QR manual?"}
      </button>

      {qrOpen ? (
        <div className="mb-3 space-y-1.5">
          <Label htmlFor="qr-payload">Kode QR Dojo / Ranting (opsional)</Label>
          <Input
            id="qr-payload"
            value={qrPayload}
            onChange={(e) => setQrPayload(e.target.value)}
            placeholder="Tempel hasil scan / kode dojo"
          />
        </div>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          className="w-full gap-2 bg-inkai-red hover:bg-inkai-red/90 sm:flex-1"
          disabled={loading}
          onClick={() => void checkIn(false)}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MapPin className="h-4 w-4" />
          )}
          Absen Dengan Lokasi GPS
        </Button>
        {bioSupported && bioRegistered ? (
          <Button
            type="button"
            variant="outline"
            className="w-full gap-2 sm:flex-1"
            disabled={loading}
            onClick={() => void checkIn(true)}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Fingerprint className="h-4 w-4" />
            )}
            Absen Biometrik
          </Button>
        ) : null}
      </div>

      {/* Camera QR Scanner Modal */}
      <Dialog open={scanOpen} onOpenChange={(open) => { if (!open) stopScan(); }}>
        <DialogContent className="sm:max-w-md p-4">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between text-base font-bold">
              <span className="flex items-center gap-2">
                <Camera className="h-5 w-5 text-inkai-red" />
                Scan Kode QR Dojo Ranting
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={stopScan}
              >
                <X className="h-4 w-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col items-center">
            {scanError ? (
              <div className="w-full rounded-xl bg-destructive/10 p-4 text-center text-xs text-destructive">
                <p className="font-semibold">{scanError}</p>
                <p className="mt-2 text-muted-foreground">
                  Gunakan input teks manual "Punya kode QR manual?" atau izinkan akses kamera pada peramban Anda.
                </p>
              </div>
            ) : (
              <div className="relative aspect-square w-full max-w-[320px] overflow-hidden rounded-2xl border-2 border-inkai-red/50 bg-black">
                <video
                  ref={videoRef}
                  className="h-full w-full object-cover"
                  playsInline
                  muted
                />
                {/* Viewfinder frame overlay */}
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="h-48 w-48 rounded-2xl border-2 border-dashed border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]" />
                </div>
                <div className="pointer-events-none absolute bottom-3 left-0 right-0 text-center text-xs font-semibold text-white drop-shadow">
                  Arahkan kamera ke Barcode Poster Dojo
                </div>
              </div>
            )}

            <div className="mt-3 flex w-full items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1 text-xs"
                onClick={() =>
                  void startScan(facingMode === "environment" ? "user" : "environment")
                }
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Ganti Kamera
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground"
                onClick={stopScan}
              >
                Tutup
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Member Home Dojo QR Modal */}
      {defaultDojoId && homeDojoName ? (
        <DojoQrModal
          open={myDojoQrOpen}
          onOpenChange={setMyDojoQrOpen}
          dojo={{ id: defaultDojoId, name: homeDojoName }}
        />
      ) : null}
    </div>
  );
}
