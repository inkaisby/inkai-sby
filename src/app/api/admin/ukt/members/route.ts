import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { inkaiFetch } from "@/lib/inkai-api/server";
import { uktMemberCreateSchema } from "@/lib/security/schemas";
import { createAdminMember } from "@/lib/admin-member-create";
import { prisma } from "@/lib/prisma";
import { buildMemberFilter, getPrimaryAdminRole } from "@/lib/rbac";
import { getManagedDojoIdsFromUser } from "@/lib/managed-dojos";

export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!authResult.token) {
    return NextResponse.json({ error: "Token tidak tersedia" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = uktMemberCreateSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message;
    return NextResponse.json(
      { error: first || "Data tidak valid" },
      { status: 400 },
    );
  }

  return createAdminMember({
    user: authResult.user,
    token: authResult.token,
    input: parsed.data,
    request,
    auditAction: "UKT_MEMBER_CREATE",
  });
}

export async function GET(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!authResult.token) {
    return NextResponse.json({ error: "Token tidak tersedia" }, { status: 401 });
  }

  // Fail-closed: admin ranting tanpa ranting terkelola tidak berhak melihat data anggota manapun.
  const primaryRole = getPrimaryAdminRole(authResult.user.roles);
  if (primaryRole === "ADMIN_DOJO") {
    const allowlist = getManagedDojoIdsFromUser(authResult.user);
    if (allowlist.length === 0) {
      return NextResponse.json(
        { error: "Akun belum terhubung ke ranting" },
        { status: 403 },
      );
    }
  }

  const { searchParams } = new URL(request.url);
  const memberId = searchParams.get("memberId");
  if (!memberId) {
    return NextResponse.json({ error: "memberId wajib" }, { status: 400 });
  }

  // Verifikasi anggota berada dalam cakupan RBAC sebelum meneruskan ke Inkai (anti-IDOR).
  const scopedMember = await prisma.member.findFirst({
    where: { AND: [{ id: memberId }, buildMemberFilter(authResult.user)] },
    select: { id: true },
  });
  if (!scopedMember) {
    return NextResponse.json(
      { error: "Anggota tidak ditemukan atau di luar cakupan" },
      { status: 403 },
    );
  }

  const { res, data } = await inkaiFetch(`/v1/members/${memberId}`, {}, authResult.token);
  if (!res.ok) {
    return NextResponse.json(
      { error: "Anggota tidak ditemukan" },
      { status: res.status === 404 ? 404 : 400 },
    );
  }

  return NextResponse.json({ member: data.data });
}
