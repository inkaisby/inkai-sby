import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { resolveSekretarisScope, buildSuratNumberFormat } from "@/lib/sekretaris-rbac";

export async function GET(req: NextRequest) {
  try {
    const { session } = await requireAdminSession();
    const scope = resolveSekretarisScope(session.user);
    const { searchParams } = new URL(req.url);

    const kategori = searchParams.get("kategori") || "UNDANGAN";
    const dateStr = searchParams.get("date");
    const date = dateStr ? new Date(dateStr) : new Date();

    const count = await prisma.suratEntry.count({
      where: { scopeType: scope.scopeType, scopeId: scope.scopeId },
    });

    let dojoName = undefined;
    if (scope.scopeType === "DOJO" && scope.scopeId !== "main") {
      const dojo = await prisma.dojo.findUnique({ where: { id: scope.scopeId } });
      if (dojo) dojoName = dojo.name;
    }

    const nextNumber = buildSuratNumberFormat(
      count + 1,
      kategori,
      scope.scopeType,
      dojoName,
      date
    );

    return NextResponse.json({ success: true, nextNumber, seq: count + 1 });
  } catch (error: any) {
    console.error("[GET /api/admin/sekretaris/surat/next-number]", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
