import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { kasTransferSchema } from "@/lib/security/schemas";
import {
  KasPeriodLockedError,
  KasScopeError,
  canTransferKas,
  resolveKasScopeForView,
  transferManualKas,
} from "@/lib/kas-store";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Ctx) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!canTransferKas(authResult.user)) {
    return NextResponse.json({ error: "Tidak berhak memindahkan kas" }, { status: 403 });
  }

  const parsed = kasTransferSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Data transfer tidak valid" }, { status: 400 });
  }

  try {
    const sourceScope = await resolveKasScopeForView(authResult.user, {
      type: request.headers.get("x-kas-scope-type"),
      id: request.headers.get("x-kas-scope-id"),
    });
    const row = await transferManualKas({
      id: (await context.params).id,
      sourceScope,
      targetScope: {
        type: parsed.data.targetScopeType,
        id: parsed.data.targetScopeId,
      },
      user: authResult.user,
      token: authResult.token,
      email: authResult.user.email,
    });
    if (!row) {
      return NextResponse.json(
        { error: "Hanya baris manual yang dapat dipindahkan" },
        { status: 400 },
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof KasPeriodLockedError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof KasScopeError || error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Gagal memindahkan kas" }, { status: 400 });
  }
}
