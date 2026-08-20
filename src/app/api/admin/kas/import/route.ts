import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireAdmin } from "@/lib/admin-auth";
import { kasImportSchema } from "@/lib/security/schemas";
import { KAS_MAX_IMPORT } from "@/lib/kas";
import {
  KasPeriodLockedError,
  canWriteKas,
  postKasBatch,
  resolveKasScopeForView,
} from "@/lib/kas-store";

export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!canWriteKas(authResult.user, authResult.adminDojoGrants)) {
    return NextResponse.json({ error: "Tidak berhak impor kas" }, { status: 403 });
  }
  const parsed = kasImportSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "File/impor tidak valid" }, { status: 400 });
  }
  if (parsed.data.entries.length > KAS_MAX_IMPORT) {
    return NextResponse.json(
      { error: `Maksimal ${KAS_MAX_IMPORT} baris` },
      { status: 400 },
    );
  }
  try {
    const scope = await resolveKasScopeForView(authResult.user, {
      type: request.headers.get("x-kas-scope-type"),
      id: request.headers.get("x-kas-scope-id"),
    });
    const result = await postKasBatch(
      parsed.data.entries.map((e) => ({
        scope,
        txnDate: e.txnDate,
        description: e.description,
        kegiatan: e.kegiatan,
        direction: e.direction,
        amount: e.amount,
        sourceType: "manual" as const,
        sourceId: randomUUID(),
        createdById: authResult.user.id,
      })),
    );
    return NextResponse.json({ success: true, created: result.created });
  } catch (error) {
    if (error instanceof KasPeriodLockedError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    const msg = error instanceof Error ? error.message : "Gagal impor";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
