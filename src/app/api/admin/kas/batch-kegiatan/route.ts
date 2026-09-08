import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import {
  KasPeriodLockedError,
  assertKasMonthWritable,
  canWriteKas,
  resolveKasScopeForView,
} from "@/lib/kas-store";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!canWriteKas(authResult.user, authResult.adminDojoGrants)) {
    return NextResponse.json({ error: "Tidak berhak mengubah kas" }, { status: 403 });
  }

  try {
    const body = (await request.json().catch(() => null)) as {
      ids?: string[];
      kegiatan?: string;
    } | null;

    const ids = body?.ids;
    const kegiatan = (body?.kegiatan ?? "").trim().slice(0, 120);

    if (!ids || ids.length === 0) {
      return NextResponse.json({ error: "Tidak ada baris terpilih" }, { status: 400 });
    }

    const scope = await resolveKasScopeForView(authResult.user, {
      type: request.headers.get("x-kas-scope-type"),
      id: request.headers.get("x-kas-scope-id"),
    });

    const rows = await prisma.kasEntry.findMany({
      where: { id: { in: ids }, scopeType: scope.type, scopeId: scope.id },
    });

    for (const row of rows) {
      await assertKasMonthWritable(scope, row.txnDate.toISOString().slice(0, 10));
    }

    const result = await prisma.kasEntry.updateMany({
      where: { id: { in: rows.map((r) => r.id) } },
      data: { kegiatan },
    });

    return NextResponse.json({ success: true, updated: result.count });
  } catch (error) {
    if (error instanceof KasPeriodLockedError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    const msg = error instanceof Error ? error.message : "Gagal mengubah kegiatan";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
