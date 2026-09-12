import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import { loadAbsensiClientPayload } from "@/lib/admin-absensi-data";
import { inkaiFetch } from "@/lib/inkai-api/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  const token = await getInkaiAccessToken();
  if (!token) {
    return NextResponse.json({ error: "Sesi tidak valid" }, { status: 401 });
  }

  const sp = new URL(request.url).searchParams;
  try {
    const payload = await loadAbsensiClientPayload(
      token,
      authResult.user,
      {
        date: sp.get("date") ?? undefined,
        semester: sp.get("semester") ?? undefined,
        year: Number(sp.get("year") || 0) || undefined,
        cabangId: sp.get("cabangId") ?? undefined,
        dojoId: sp.get("dojoId") ?? undefined,
      },
    );
    return NextResponse.json(payload);
  } catch (error) {
    console.error("[absensi-api]", error);
    return NextResponse.json(
      { error: "Gagal memuat data absensi" },
      { status: 502 },
    );
  }
}

export async function PATCH(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  const token = await getInkaiAccessToken();
  if (!token) {
    return NextResponse.json({ error: "Sesi tidak valid" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    id?: string;
    dojoId?: string;
    checkInAt?: string;
  };

  const id = body.id?.trim();
  if (!id) {
    return NextResponse.json(
      { error: "ID absensi tidak boleh kosong" },
      { status: 400 },
    );
  }

  const dojoId = body.dojoId?.trim();
  const checkInAtStr = body.checkInAt?.trim();

  if (!dojoId && !checkInAtStr) {
    return NextResponse.json(
      { error: "Tidak ada data yang diubah" },
      { status: 400 },
    );
  }

  let checkInDate: Date | undefined = undefined;
  if (checkInAtStr) {
    const d = new Date(checkInAtStr);
    if (isNaN(d.getTime())) {
      return NextResponse.json(
        { error: "Format tanggal check-in tidak valid" },
        { status: 400 },
      );
    }
    checkInDate = d;
  }

  if (dojoId) {
    const dojoExists = await prisma.dojo.findFirst({
      where: { id: dojoId, isDeleted: false },
      select: { id: true },
    });
    if (!dojoExists) {
      return NextResponse.json(
        { error: "Ranting / Dojo tidak ditemukan" },
        { status: 400 },
      );
    }
  }

  try {
    // 1. Update in local Prisma
    await prisma.attendance.updateMany({
      where: { id },
      data: {
        ...(dojoId ? { dojoId } : {}),
        ...(checkInDate ? { checkInAt: checkInDate } : {}),
      },
    });

    // 2. Try update in Inkai API
    try {
      await inkaiFetch(
        `/v1/attendance/${id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            ...(dojoId ? { dojoId } : {}),
            ...(checkInDate ? { checkInAt: checkInDate.toISOString() } : {}),
          }),
        },
        token,
      );
    } catch {
      // Ignore Inkai API error if local Prisma update succeeded
    }

    return NextResponse.json({
      success: true,
      message: "Absensi berhasil dikoreksi",
    });
  } catch (error) {
    console.error("[absensi-patch]", error);
    return NextResponse.json(
      { error: "Gagal mengkoreksi absensi" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  const token = await getInkaiAccessToken();
  if (!token) {
    return NextResponse.json({ error: "Sesi tidak valid" }, { status: 401 });
  }

  const url = new URL(request.url);
  let id = url.searchParams.get("id")?.trim();

  if (!id) {
    const body = (await request.json().catch(() => ({}))) as { id?: string };
    id = body.id?.trim();
  }

  if (!id) {
    return NextResponse.json(
      { error: "ID absensi tidak boleh kosong" },
      { status: 400 },
    );
  }

  try {
    // 1. Soft-delete in local Prisma
    await prisma.attendance.updateMany({
      where: { id },
      data: { isDeleted: true },
    });

    // 2. Try delete in Inkai API
    try {
      await inkaiFetch(`/v1/attendance/${id}`, { method: "DELETE" }, token);
    } catch {
      // Ignore Inkai API error if local Prisma soft-delete succeeded
    }

    return NextResponse.json({
      success: true,
      message: "Absensi berhasil dihapus",
    });
  } catch (error) {
    console.error("[absensi-delete]", error);
    return NextResponse.json(
      { error: "Gagal menghapus absensi" },
      { status: 500 },
    );
  }
}

