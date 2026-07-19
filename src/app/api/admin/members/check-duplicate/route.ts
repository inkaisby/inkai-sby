import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import {
  findMemberDuplicates,
  hardDuplicates,
} from "@/lib/member-duplicate";

export async function GET(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  const { searchParams } = new URL(request.url);
  const fullName = searchParams.get("fullName")?.trim() || searchParams.get("q")?.trim() || "";
  const birthDate = searchParams.get("birthDate")?.trim() || "";
  const nik = searchParams.get("nik")?.trim() || "";
  const nia = searchParams.get("nia")?.trim() || "";

  if (!fullName && !nik && !nia) {
    return NextResponse.json({ duplicates: [], suggestions: [], blocked: false });
  }

  const duplicates = await findMemberDuplicates({
    fullName,
    birthDate: birthDate || undefined,
    nik: nik || undefined,
    nia: nia || undefined,
  });

  const hard = hardDuplicates(duplicates);
  return NextResponse.json({
    duplicates,
    suggestions: duplicates.map((d) => ({
      id: d.id,
      fullName: d.fullName,
      nia: d.nia,
      dojoName: d.dojoName,
      status: d.status,
      hasAccount: d.hasAccount,
      matchReasons: d.reasons,
      severity: d.severity,
    })),
    blocked: hard.length > 0,
  });
}
