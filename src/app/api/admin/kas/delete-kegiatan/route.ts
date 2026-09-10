import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import {
  KasPeriodLockedError,
  KasScopeError,
  canWriteKas,
  deleteKasByKegiatan,
  resolveKasScopeForView,
} from "@/lib/kas-store";

export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!canWriteKas(authResult.user, authResult.adminDojoGrants)) {
    return NextResponse.json({ error: "Tidak berhak mengelola kas" }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => null);
    const kegiatan = typeof body?.kegiatan === "string" ? body.kegiatan.trim() : "";
    if (!kegiatan) {
      return NextResponse.json({ error: "Nama kegiatan wajib diisi" }, { status: 400 });
    }

    const scope = await resolveKasScopeForView(authResult.user, {
      type: request.headers.get("x-kas-scope-type"),
      id: request.headers.get("x-kas-scope-id"),
    });

    const result = await deleteKasByKegiatan({
      scope,
      kegiatan,
      user: authResult.user,
      email: authResult.user.email,
      token: authResult.token,
    });

    return NextResponse.json({ success: true, deleted: result.deleted });
  } catch (error) {
    if (error instanceof KasPeriodLockedError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof KasScopeError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal menghapus kegiatan" },
      { status: 400 },
    );
  }
}
