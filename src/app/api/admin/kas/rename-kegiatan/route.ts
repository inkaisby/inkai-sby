import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import {
  KasPeriodLockedError,
  canWriteKas,
  renameKasKegiatan,
  resolveKasScopeForView,
} from "@/lib/kas-store";

export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!canWriteKas(authResult.user, authResult.adminDojoGrants)) {
    return NextResponse.json({ error: "Tidak berhak mengubah kegiatan kas" }, { status: 403 });
  }

  try {
    const body = (await request.json().catch(() => null)) as {
      oldKegiatan?: string;
      newKegiatan?: string;
    } | null;

    if (!body?.oldKegiatan || !body?.newKegiatan) {
      return NextResponse.json({ error: "oldKegiatan dan newKegiatan wajib diisi" }, { status: 400 });
    }

    const scope = await resolveKasScopeForView(authResult.user, {
      type: request.headers.get("x-kas-scope-type"),
      id: request.headers.get("x-kas-scope-id"),
    });

    const result = await renameKasKegiatan({
      scope,
      oldKegiatan: body.oldKegiatan,
      newKegiatan: body.newKegiatan,
    });

    return NextResponse.json({ success: true, updated: result.updated });
  } catch (error) {
    if (error instanceof KasPeriodLockedError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    const msg = error instanceof Error ? error.message : "Gagal mengubah nama kegiatan";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
