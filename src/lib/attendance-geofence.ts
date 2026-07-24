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

/** Dojo dalam radius, diurutkan terdekat. */
export function matchDojosInGeofence(
  latitude: number,
  longitude: number,
  dojos: GeofencedDojo[],
): GeofenceMatch[] {
  const hits: GeofenceMatch[] = [];
  for (const dojo of dojos) {
    const distanceMeters = haversineMeters(
      latitude,
      longitude,
      dojo.latitude,
      dojo.longitude,
    );
    const radius = Math.max(10, dojo.geofenceRadius || 50);
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
): GeofenceMatch | null {
  return matchDojosInGeofence(latitude, longitude, dojos)[0] ?? null;
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
      geofenceRadius: d.geofenceRadius || 50,
    }));
}
