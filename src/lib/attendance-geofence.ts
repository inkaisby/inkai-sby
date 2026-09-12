import { SITE_BRANCH_NAME } from "@/lib/site";

export type GeofencedDojo = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  geofenceRadius: number;
};

/** Jarak haversine dalam meter. */
export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export type GeofenceMatch = {
  dojo: GeofencedDojo;
  distanceMeters: number;
};

/** Dojo dalam radius, diurutkan terdekat. Toleransi default 150m untuk indoor GPS drift. */
export function matchDojosInGeofence(
  latitude: number,
  longitude: number,
  dojos: GeofencedDojo[],
  overrideRadiusMeters?: number,
): GeofenceMatch[] {
  const hits: GeofenceMatch[] = [];
  for (const dojo of dojos) {
    const distanceMeters = haversineMeters(
      latitude,
      longitude,
      dojo.latitude,
      dojo.longitude,
    );
    const radius = overrideRadiusMeters ?? Math.max(150, dojo.geofenceRadius || 150);
    if (distanceMeters <= radius) {
      hits.push({ dojo, distanceMeters });
    }
  }
  hits.sort((a, b) => a.distanceMeters - b.distanceMeters);
  return hits;
}

export function pickNearestInGeofence(
  latitude: number,
  longitude: number,
  dojos: GeofencedDojo[],
  overrideRadiusMeters?: number,
): GeofenceMatch | null {
  return matchDojosInGeofence(latitude, longitude, dojos, overrideRadiusMeters)[0] ?? null;
}

/**
 * Memformat payload QR Ranting/Dojo standar INKAI Surabaya.
 */
export function buildDojoQrPayload(dojoId: string, dojoName?: string): string {
  return `INKAI:DOJO:${dojoId.trim()}${dojoName ? `:${dojoName.trim()}` : ""}`;
}

/**
 * Mengekstrak dojoId dari string hasil scan QR Code.
 */
export function parseDojoQrPayload(raw: string): string | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Format 1: INKAI:DOJO:<dojoId> or INKAI:DOJO:<dojoId>:<name>
  if (trimmed.startsWith("INKAI:DOJO:")) {
    const parts = trimmed.split(":");
    if (parts[2]) return parts[2].trim();
  }

  // Format 2: DOJO:<dojoId>
  if (trimmed.startsWith("DOJO:")) {
    const parts = trimmed.split(":");
    if (parts[1]) return parts[1].trim();
  }

  // Format 3: JSON {"dojoId": "..."} or {"id": "..."}
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const obj = JSON.parse(trimmed) as Record<string, unknown>;
      if (typeof obj.dojoId === "string" && obj.dojoId.trim()) {
        return obj.dojoId.trim();
      }
      if (typeof obj.id === "string" && obj.id.trim()) {
        return obj.id.trim();
      }
    } catch {
      /* ignore json error */
    }
  }

  // Format 4: URL dengan query ?dojoId=... atau pathname /dojo/...
  if (trimmed.includes("http://") || trimmed.includes("https://")) {
    try {
      const url = new URL(trimmed);
      const dojoParam = url.searchParams.get("dojoId") || url.searchParams.get("dojo");
      if (dojoParam) return dojoParam.trim();
      const pathParts = url.pathname.split("/").filter(Boolean);
      const dojoIdx = pathParts.indexOf("dojo");
      if (dojoIdx !== -1 && pathParts[dojoIdx + 1]) {
        return pathParts[dojoIdx + 1].trim();
      }
    } catch {
      /* ignore url error */
    }
  }

  // Format 5: Direct string ID (e.g. CUID or UUID or alphanumeric)
  if (/^[a-zA-Z0-9_-]{10,64}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

export async function loadGeofencedDojosForCabang(): Promise<GeofencedDojo[]> {
  const { prisma } = await import("@/lib/prisma");
  const rows = await prisma.dojo.findMany({
    where: {
      isDeleted: false,
      latitude: { not: null },
      longitude: { not: null },
      branch: {
        isDeleted: false,
        name: { equals: SITE_BRANCH_NAME, mode: "insensitive" },
      },
    },
    select: {
      id: true,
      name: true,
      latitude: true,
      longitude: true,
      geofenceRadius: true,
    },
    orderBy: { name: "asc" },
  });
  return rows
    .filter(
      (d): d is typeof d & { latitude: number; longitude: number } =>
        d.latitude != null && d.longitude != null,
    )
    .map((d) => ({
      id: d.id,
      name: d.name,
      latitude: d.latitude,
      longitude: d.longitude,
      geofenceRadius: d.geofenceRadius || 150,
    }));
}
