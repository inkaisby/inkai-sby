import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { kasTransferBatchSchema } from "@/lib/security/schemas";
import {
  KasPeriodLockedError,
  KasScopeError,
  canTransferKas,
  resolveKasScopeForView,
  transferManualKasByIds,
} from "@/lib/kas-store";

export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!canTransferKas(authResult.user)) {
    return NextResponse.json({ error: "Tidak berhak memindahkan kas" }, { status: 403 });
  }

  const parsed = kasTransferBatchSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Data transfer tidak valid" }, { status: 400 });
  }

  try {
    const sourceScope = await resolveKasScopeForView(authResult.user, {
      type: request.headers.get("x-kas-scope-type"),
      id: request.headers.get("x-kas-scope-id"),
    });
    const result = await transferManualKasByIds({
      ids: parsed.data.ids,
      sourceScope,
      targetScope: {
        type: parsed.data.targetScopeType,
        id: parsed.data.targetScopeId,
      },
      user: authResult.user,
      token: authResult.token,
      email: authResult.user.email,
    });
    if (result.moved === 0) {
      return NextResponse.json(
        { error: "Tidak ada baris manual valid" },
        { status: 400 },
      );
    }
    return NextResponse.json({ success: true, moved: result.moved });
  } catch (error) {
    if (error instanceof KasPeriodLockedError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof KasScopeError || error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Gagal memindahkan baris" }, { status: 400 });
  }
}
