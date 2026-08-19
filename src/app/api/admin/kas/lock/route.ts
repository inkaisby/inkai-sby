import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { kasLockSchema } from "@/lib/security/schemas";
import {
  canLockKasPeriod,
  resolveKasScope,
  setKasPeriodLock,
} from "@/lib/kas-store";

export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!canLockKasPeriod(authResult.user)) {
    return NextResponse.json(
      { error: "Hanya cabang yang dapat menutup buku kas" },
      { status: 403 },
    );
  }
  const parsed = kasLockSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Periode tidak valid" }, { status: 400 });
  }
  const scope = await resolveKasScope(authResult.user);
  await setKasPeriodLock({
    scope,
    yearMonth: parsed.data.yearMonth,
    lock: parsed.data.lock,
    userId: authResult.user.id,
    reason: parsed.data.reason,
    token: authResult.token,
    email: authResult.user.email,
  });
  return NextResponse.json({ success: true });
}
