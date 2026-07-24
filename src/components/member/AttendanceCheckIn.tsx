"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { showError, showSuccess } from "@/lib/client-toast";
import { Fingerprint, Loader2, MapPin } from "lucide-react";

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

  async function checkIn(withBiometric: boolean) {
    setLoading(true);
    try {
      let biometricToken: string | null = null;
      if (withBiometric) {
        biometricToken = await verifyBiometric();
      }

      const pos = await getPosition();
      const dojoId =
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
          method: qrPayload.trim() ? "QR_SCAN" : "GPS",
          qrPayload: qrPayload.trim() || undefined,
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

  return (
    <div className="mb-6 rounded-2xl border border-border/60 bg-card p-4">
      <h3 className="mb-1 font-semibold">Absen sekarang</h3>
      <p className="mb-1 text-sm text-muted-foreground">
        {homeDojoName
          ? `Dojo Anda: ${homeDojoName}`
          : "Gunakan lokasi perangkat di area dojo."}
      </p>
      <p className="mb-3 text-xs text-muted-foreground">
        GPS menentukan dojo terdekat. Latihan bersama? ketuk “Bukan di sini?”.
      </p>

      <div className="mb-3 flex flex-wrap gap-2">
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
              <Label className="text-xs">Pilih dojo</Label>
              <select
                className="h-10 w-full rounded-lg border bg-background px-2 text-sm"
                value={selectedDojoId || ""}
                onChange={(e) => {
                  setSelectedDojoId(e.target.value || null);
                  setSelectedEventId(null);
                }}
              >
                <option value="">Otomatis (terdekat)</option>
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
        className="mb-3 text-xs font-semibold text-inkai-red"
        onClick={() => setQrOpen((v) => !v)}
      >
        {qrOpen ? "Sembunyikan kode QR" : "Punya kode QR?"}
      </button>
      {qrOpen ? (
        <div className="mb-3 space-y-1.5">
          <Label htmlFor="qr-payload">Kode QR dojo (opsional)</Label>
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
          Absen dengan lokasi
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
            Absen biometrik
          </Button>
        ) : null}
      </div>
    </div>
  );
}
