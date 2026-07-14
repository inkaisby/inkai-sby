import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { buildDojoFilter, buildMemberFilter, getPrimaryAdminRole } from "@/lib/rbac";
import { uktMemberCreateSchema } from "@/lib/security/schemas";
import { writeAuditLog } from "@/lib/audit";
import { getClientIp } from "@/lib/security/request";

export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  const body = await request.json();
  const parsed = uktMemberCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const role = getPrimaryAdminRole(authResult.user.roles);
  let dojoId = parsed.data.dojoId;

  if (role === "ADMIN_DOJO") {
    if (!authResult.user.managedDojoId) {
      return NextResponse.json({ error: "Dojo tidak terkonfigurasi" }, { status: 403 });
    }
    dojoId = authResult.user.managedDojoId;
  } else if (!dojoId) {
    const dojo = await prisma.dojo.findFirst({
      where: buildDojoFilter(authResult.user),
      orderBy: { name: "asc" },
    });
    if (!dojo) {
      return NextResponse.json({ error: "Dojo tidak ditemukan" }, { status: 404 });
    }
    dojoId = dojo.id;
  }

  const dojo = await prisma.dojo.findFirst({
    where: { id: dojoId, ...buildDojoFilter(authResult.user) },
  });
  if (!dojo) {
    return NextResponse.json({ error: "Dojo tidak ditemukan" }, { status: 404 });
  }

  const canSetNia = ["ADMINISTRATOR", "ADMIN_PUSAT", "ADMIN_PROVINCE", "ADMIN_BRANCH", "ADMIN"].includes(role);

  const member = await prisma.member.create({
    data: {
      fullName: parsed.data.fullName.toUpperCase(),
      gender: parsed.data.gender || null,
      birthPlace: parsed.data.birthPlace || null,
      birthDate: parsed.data.birthDate ? new Date(parsed.data.birthDate) : null,
      address: parsed.data.address || null,
      dojoId,
      currentRank: canSetNia ? "Putih (Kyu 10)" : "Putih (Kyu 10)",
      nia: canSetNia ? null : null,
      status: "Active",
    },
    include: { dojo: true },
  });

  await writeAuditLog({
    userId: authResult.user.id,
    email: authResult.user.email,
    action: "UKT_MEMBER_CREATE",
    details: `Created member ${member.fullName} at ${dojo.name}`,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ success: true, member });
}

export async function GET(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  const { searchParams } = new URL(request.url);
  const memberId = searchParams.get("memberId");
  if (!memberId) {
    return NextResponse.json({ error: "memberId wajib" }, { status: 400 });
  }

  const member = await prisma.member.findFirst({
    where: { id: memberId, ...buildMemberFilter(authResult.user) },
    include: {
      dojo: { include: { branch: true } },
      billings: {
        where: { isDeleted: false, status: { in: ["PENDING", "WAITING_VERIFICATION"] } },
        orderBy: { dueDate: "asc" },
        take: 10,
      },
      ranks: { orderBy: { date: "desc" }, take: 5 },
      eventRegistrations: {
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { event: true, category: true },
      },
      user: { select: { photoUrl: true } },
    },
  });

  if (!member) {
    return NextResponse.json({ error: "Anggota tidak ditemukan" }, { status: 404 });
  }

  return NextResponse.json({ member });
}
