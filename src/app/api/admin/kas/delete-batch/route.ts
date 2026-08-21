import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { kasDeleteBatchSchema } from "@/lib/security/schemas";
import {
  KasPeriodLockedError,
  canWriteKas,
  deleteManualKasByIds,
  resolveKasScopeForView,
} from "@/lib/kas-store";

export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!canWriteKas(authResult.user, authResult.adminDojoGrants)) {
    return NextResponse.json({ error: "Tidak berhak menghapus kas" }, { status: 403 });
  }

  const parsed = kasDeleteBatchSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Data hapus tidak valid" }, { status: 400 });
  }

  try {
    const scope = await resolveKasScopeForView(authResult.user, {
      type: request.headers.get("x-kas-scope-type"),
      id: request.headers.get("x-kas-scope-id"),
    });
    const result = await deleteManualKasByIds({
      ids: parsed.data.ids,
      scope,
      user: authResult.user,
      token: authResult.token,
      email: authResult.user.email,
    });
    if (result.deleted === 0) {
      return NextResponse.json(
        { error: "Tidak ada baris manual valid" },
        { status: 400 },
      );
    }
    return NextResponse.json({ success: true, deleted: result.deleted });
  } catch (error) {
    if (error instanceof KasPeriodLockedError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Gagal menghapus baris" }, { status: 400 });
  }
}
