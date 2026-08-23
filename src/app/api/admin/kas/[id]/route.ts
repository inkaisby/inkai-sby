import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { kasPatchSchema } from "@/lib/security/schemas";
import {
  KasPeriodLockedError,
  canWriteKas,
  deleteManualKas,
  resolveKasScopeForView,
  setKasRecon,
  updateManualKas,
} from "@/lib/kas-store";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Ctx) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!canWriteKas(authResult.user, authResult.adminDojoGrants)) {
    return NextResponse.json({ error: "Tidak berhak mengubah kas" }, { status: 403 });
  }
  const { id } = await context.params;
  const parsed = kasPatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }
  try {
    const scope = await resolveKasScopeForView(authResult.user, {
      type: request.headers.get("x-kas-scope-type"),
      id: request.headers.get("x-kas-scope-id"),
    });
    if (parsed.data.reconStatus) {
      const ok = await setKasRecon(id, scope, parsed.data.reconStatus);
      if (!ok) return NextResponse.json({ error: "Baris tidak ditemukan" }, { status: 404 });
    }
    if (
      parsed.data.txnDate ||
      parsed.data.description ||
      parsed.data.kegiatan != null ||
      parsed.data.direction ||
      parsed.data.amount
    ) {
      const row = await updateManualKas(id, scope, parsed.data);
      if (!row) {
        return NextResponse.json(
          { error: "Baris tidak ditemukan" },
          { status: 404 },
        );
      }
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof KasPeriodLockedError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: "Gagal mengubah kas" }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: Ctx) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!canWriteKas(authResult.user, authResult.adminDojoGrants)) {
    return NextResponse.json({ error: "Tidak berhak menghapus kas" }, { status: 403 });
  }
  const { id } = await context.params;
  try {
    const scope = await resolveKasScopeForView(authResult.user, {
      type: _request.headers.get("x-kas-scope-type"),
      id: _request.headers.get("x-kas-scope-id"),
    });
    const ok = await deleteManualKas(id, scope);
    if (!ok) {
      return NextResponse.json(
        { error: "Hanya baris manual yang dapat dihapus" },
        { status: 400 },
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof KasPeriodLockedError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: "Gagal menghapus" }, { status: 400 });
  }
}
