import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import {
  buildScopedDojoWhere,
  canManageGeofencing,
} from "@/lib/pengaturan";
import { geofencingSchema } from "@/lib/security/schemas";
import { getClientIp } from "@/lib/security/request";

export async function GET() {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!canManageGeofencing(authResult.user)) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const dojos = await prisma.dojo.findMany({
    where: buildScopedDojoWhere(authResult.user),
    select: {
      id: true,
      name: true,
      latitude: true,
      longitude: true,
      geofenceRadius: true,
      branch: { select: { name: true } },
    },
    orderBy: { name: "asc" },
    take: 200,
  });

  return NextResponse.json({ data: dojos });
}

export async function PATCH(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!canManageGeofencing(authResult.user)) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const parsed = geofencingSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const allowed = await prisma.dojo.findFirst({
    where: {
      AND: [{ id: parsed.data.dojoId }, buildScopedDojoWhere(authResult.user)],
    },
    select: { id: true, name: true },
  });
  if (!allowed) {
    return NextResponse.json({ error: "Ranting tidak ditemukan" }, { status: 404 });
  }

  // Backend org update belum expose lat/lng — tulis langsung ke DB bersama (sama pola reset-password lokal)
  const updated = await prisma.dojo.update({
    where: { id: parsed.data.dojoId },
    data: {
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      geofenceRadius: parsed.data.geofenceRadius,
    },
    select: {
      id: true,
      name: true,
      latitude: true,
      longitude: true,
      geofenceRadius: true,
    },
  });

  writeAuditLog({
    userId: authResult.user.id,
    email: authResult.user.email,
    action: "SETTINGS_GEOFENCE_UPDATE",
    details: JSON.stringify({
      dojoId: updated.id,
      dojoName: updated.name,
      latitude: updated.latitude,
      longitude: updated.longitude,
      geofenceRadius: updated.geofenceRadius,
    }),
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    token: authResult.token,
  });

  return NextResponse.json({
    success: true,
    data: updated,
    message: "Geofencing berhasil disimpan",
  });
}
