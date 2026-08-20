import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { canAccessKas, listKasScopes } from "@/lib/kas-store";

export async function GET() {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!canAccessKas(authResult.user, authResult.adminDojoGrants)) {
    return NextResponse.json({ error: "Tidak berhak membuka Kas" }, { status: 403 });
  }

  const scopes = await listKasScopes(authResult.user);
  return NextResponse.json({ success: true, scopes });
}
