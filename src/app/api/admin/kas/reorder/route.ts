import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import {
  KasPeriodLockedError,
  canWriteKas,
  reorderKasEntries,
  resolveKasScopeForView,
} from "@/lib/kas-store";

export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!canWriteKas(authResult.user, authResult.adminDojoGrants)) {
    return NextResponse.json({ error: "Tidak berhak mengubah urutan kas" }, { status: 403 });
  }

  try {
    const body = (await request.json().catch(() => null)) as {
      orderedIds?: string[];
    } | null;

    if (!Array.isArray(body?.orderedIds) || body.orderedIds.length === 0) {
      return NextResponse.json({ error: "orderedIds wajib diisi" }, { status: 400 });
    }

    const scope = await resolveKasScopeForView(authResult.user, {
      type: request.headers.get("x-kas-scope-type"),
      id: request.headers.get("x-kas-scope-id"),
    });

    const result = await reorderKasEntries({
      scope,
      orderedIds: body.orderedIds,
    });

    return NextResponse.json({ success: true, reordered: result.reordered });
  } catch (error) {
    if (error instanceof KasPeriodLockedError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    const msg = error instanceof Error ? error.message : "Gagal mengubah urutan baris kas";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
