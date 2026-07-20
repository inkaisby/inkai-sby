import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { adminMemberBulkCreateSchema } from "@/lib/security/schemas";
import { createAdminMember } from "@/lib/admin-member-create";
import { parseFlexibleBirthDate } from "@/lib/parse-birth-date";
import {
  formatRankLabel,
  normalizeGenderStorage,
  DEFAULT_MEMBER_RANK,
} from "@/lib/belt";

export const maxDuration = 60;

export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!authResult.token) {
    return NextResponse.json({ error: "Token tidak tersedia" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = adminMemberBulkCreateSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message;
    return NextResponse.json(
      { error: first || "Data tidak valid" },
      { status: 400 },
    );
  }

  const results: Array<{
    index: number;
    fullName: string;
    ok: boolean;
    error?: string;
    memberId?: string;
  }> = [];

  for (let i = 0; i < parsed.data.members.length; i++) {
    const raw = parsed.data.members[i]!;
    const gender = normalizeGenderStorage(raw.gender) ?? undefined;
    const birthDateRaw = raw.birthDate?.trim() || "";
    const birthDate =
      (birthDateRaw ? parseFlexibleBirthDate(birthDateRaw) : null) ||
      (birthDateRaw && /^\d{4}-\d{2}-\d{2}$/.test(birthDateRaw)
        ? birthDateRaw
        : undefined);
    const currentRank =
      formatRankLabel(raw.currentRank) ||
      raw.currentRank?.trim() ||
      DEFAULT_MEMBER_RANK;

    const response = await createAdminMember({
      user: authResult.user,
      token: authResult.token,
      input: {
        ...raw,
        gender: gender || undefined,
        birthDate: birthDate || undefined,
        currentRank,
        fullName: raw.fullName.trim().toUpperCase(),
        birthPlace: raw.birthPlace?.trim()
          ? raw.birthPlace.trim().toUpperCase()
          : undefined,
        address: raw.address?.trim()
          ? raw.address.trim().toUpperCase()
          : undefined,
        nia: raw.nia?.trim() ? raw.nia.trim().toUpperCase() : undefined,
      },
      request,
      auditAction: "MEMBER_CREATE_BULK",
    });

    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
      member?: { id?: string; fullName?: string };
    };

    if (response.ok) {
      results.push({
        index: i,
        fullName: raw.fullName,
        ok: true,
        memberId:
          typeof data.member?.id === "string" ? data.member.id : undefined,
      });
    } else {
      results.push({
        index: i,
        fullName: raw.fullName,
        ok: false,
        error: data.error || "Gagal menyimpan",
      });
    }
  }

  const okCount = results.filter((r) => r.ok).length;
  const failCount = results.length - okCount;

  return NextResponse.json({
    success: failCount === 0,
    okCount,
    failCount,
    results,
    message:
      failCount === 0
        ? `${okCount} anggota berhasil ditambahkan`
        : `${okCount} berhasil, ${failCount} gagal`,
  });
}
