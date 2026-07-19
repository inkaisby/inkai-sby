import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { assertBranchInScope, canManageRanting } from "@/lib/pengaturan";
import { loadManagedDojoMatrix } from "@/lib/managed-dojos";

export async function GET(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  if (!canManageRanting(authResult.user)) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const branchId = new URL(request.url).searchParams.get("branchId")?.trim();
  if (!branchId) {
    return NextResponse.json({ error: "branchId wajib" }, { status: 400 });
  }

  const scoped = await assertBranchInScope(authResult.user, branchId);
  if (!scoped) {
    return NextResponse.json(
      { error: "Cabang di luar cakupan" },
      { status: 403 },
    );
  }

  const matrix = await loadManagedDojoMatrix(branchId);
  return NextResponse.json(matrix);
}
