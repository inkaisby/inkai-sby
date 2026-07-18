"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { showError, showSuccess } from "@/lib/client-toast";

export type GeofenceDojo = {
  id: string;
  name: string;
  branchName: string;
  latitude: number | null;
  longitude: number | null;
  geofenceRadius: number;
};

export function GeofencingManager({ dojos }: { dojos: GeofenceDojo[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [radius, setRadius] = useState("50");
  const [loading, setLoading] = useState(false);

  function startEdit(d: GeofenceDojo) {
    setEditingId(d.id);
    setLatitude(d.latitude != null ? String(d.latitude) : "");
    setLongitude(d.longitude != null ? String(d.longitude) : "");
    setRadius(String(d.geofenceRadius || 50));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId || loading) return;
    setLoading(true);
    const res = await fetch("/api/admin/pengaturan/geofencing", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dojoId: editingId,
        latitude: Number(latitude),
        longitude: Number(longitude),
        geofenceRadius: Number(radius),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (res.ok) {
      showSuccess(data.message || "Geofencing disimpan");
      setEditingId(null);
      router.refresh();
    } else {
      showError(data.error || "Gagal menyimpan geofencing");
    }
  }

  if (dojos.length === 0) {
    return (
      <p className="rounded-xl border p-8 text-center text-sm text-muted-foreground">
        Tidak ada ranting dalam scope Anda.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {editingId && (
        <form
          onSubmit={handleSave}
          className="grid gap-3 rounded-xl border p-4 sm:grid-cols-3"
        >
          <div className="sm:col-span-3">
            <h3 className="font-semibold">
              Edit: {dojos.find((d) => d.id === editingId)?.name}
            </h3>
            <p className="text-sm text-muted-foreground">
              Pakai lokasi perangkat, atau salin koordinat dari Google Maps.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Latitude</Label>
            <Input
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              required
              placeholder="-7.2575"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Longitude</Label>
            <Input
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              required
              placeholder="112.7521"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Radius (meter)</Label>
            <Input
              type="number"
              min={10}
              max={5000}
              value={radius}
              onChange={(e) => setRadius(e.target.value)}
              required
            />
          </div>
          {(() => {
            const lat = Number(latitude);
            const lon = Number(longitude);
            const r = Number(radius) || 50;
            if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
            const dLat = (r * 2.8) / 111_320;
            const cos = Math.cos((lat * Math.PI) / 180);
            const dLon = cos === 0 ? dLat : (r * 2.8) / (111_320 * Math.abs(cos));
            const bbox = `${lon - dLon},${lat - dLat},${lon + dLon},${lat + dLat}`;
            const embed = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${encodeURIComponent(`${lat},${lon}`)}`;
            return (
              <div className="sm:col-span-3 space-y-2">
                <p className="text-xs text-muted-foreground">
                  Pratinjau peta (OpenStreetMap) — lingkaran merah memperkirakan radius{" "}
                  {r} m.
                </p>
                <div className="relative aspect-[16/9] overflow-hidden rounded-lg border bg-muted">
                  <iframe
                    title="Pratinjau geofence"
                    src={embed}
                    className="h-full w-full border-0"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div
                      className="rounded-full border-2 border-inkai-red/80 bg-inkai-red/15"
                      style={{
                        width: "min(42%, 180px)",
                        height: "min(42%, 180px)",
                      }}
                      aria-hidden
                    />
                  </div>
                </div>
              </div>
            );
          })()}
          <div className="flex flex-wrap gap-2 sm:col-span-3">
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => {
                if (!navigator.geolocation) {
                  showError("Perangkat tidak mendukung geolokasi");
                  return;
                }
                navigator.geolocation.getCurrentPosition(
                  (pos) => {
                    setLatitude(String(pos.coords.latitude));
                    setLongitude(String(pos.coords.longitude));
                    showSuccess("Lokasi perangkat diambil");
                  },
                  () => showError("Gagal membaca lokasi — izinkan akses lokasi"),
                  { enableHighAccuracy: true, timeout: 12_000 },
                );
              }}
            >
              Pakai lokasi saya
            </Button>
            {latitude && longitude ? (
              <a
                href={`https://www.google.com/maps?q=${encodeURIComponent(
                  `${latitude},${longitude}`,
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 items-center rounded-lg border px-3 text-sm hover:bg-muted"
              >
                Lihat di Maps
              </a>
            ) : null}
            <Button
              type="submit"
              disabled={loading}
              className="bg-inkai-red hover:bg-inkai-red/90"
            >
              {loading ? "Menyimpan..." : "Simpan"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditingId(null)}
            >
              Batal
            </Button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama Ranting</TableHead>
              <TableHead className="hidden sm:table-cell">Cabang</TableHead>
              <TableHead>Latitude</TableHead>
              <TableHead>Longitude</TableHead>
              <TableHead>Radius</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dojos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  Tidak ada data yang cocok dengan pencarian.
                </TableCell>
              </TableRow>
            ) : (
              dojos.map((d) => {
                const set = d.latitude != null && d.longitude != null;
                return (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.name}</TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">
                      {d.branchName}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {d.latitude ?? "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {d.longitude ?? "—"}
                    </TableCell>
                    <TableCell>{d.geofenceRadius} m</TableCell>
                    <TableCell>
                      <span
                        className={`text-sm ${
                          set
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-amber-700 dark:text-amber-400"
                        }`}
                      >
                        {set ? "Siap" : "Belum diatur"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => startEdit(d)}>
                        Atur
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
