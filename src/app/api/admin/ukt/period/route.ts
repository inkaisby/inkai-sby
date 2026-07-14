import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { buildEventFilter, getPrimaryAdminRole } from "@/lib/rbac";
import { uktPeriodSchema } from "@/lib/security/schemas";
import { buildUktEventTitle } from "@/lib/ukt";
import { surabayaBranchWhere } from "@/lib/security/branch-scope";
import { writeAuditLog } from "@/lib/audit";
import { getClientIp } from "@/lib/security/request";

export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  const body = await request.json();
  const parsed = uktPeriodSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const { semester, year, title } = parsed.data;
  const eventTitle = title || buildUktEventTitle(semester, year);

  const branch = await prisma.branch.findFirst({ where: surabayaBranchWhere });
  if (!branch) {
    return NextResponse.json({ error: "Cabang tidak ditemukan" }, { status: 404 });
  }

  const existing = await prisma.event.findFirst({
    where: {
      ...buildEventFilter(authResult.user),
      isDeleted: false,
      title: { equals: eventTitle, mode: "insensitive" },
    },
  });

  if (existing) {
    return NextResponse.json({ event: existing, created: false });
  }

  const role = getPrimaryAdminRole(authResult.user.roles);
  const canCreate = ["ADMINISTRATOR", "ADMIN_PUSAT", "ADMIN_PROVINCE", "ADMIN_BRANCH", "ADMIN"].includes(role);
  if (!canCreate) {
    return NextResponse.json({ error: "Hanya admin cabang yang dapat membuat periode UKT baru" }, { status: 403 });
  }

  const startMonth = semester === "I" ? 0 : 6;
  const startDate = new Date(year, startMonth, 1);
  const endDate = new Date(year, startMonth + 6, 0, 23, 59, 59);

  const event = await prisma.event.create({
    data: {
      title: eventTitle,
      description: `Ujian Kenaikan Tingkat ${eventTitle}`,
      startDate,
      endDate,
      branchId: branch.id,
      createdById: authResult.user.id,
      categories: {
        create: [
          { name: "Pendaftaran UKT", fee: 0 },
        ],
      },
    },
    include: { categories: true },
  });

  await writeAuditLog({
    userId: authResult.user.id,
    email: authResult.user.email,
    action: "UKT_PERIOD_CREATE",
    details: `Created UKT period: ${eventTitle}`,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ event, created: true });
}

export async function PATCH(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  const body = await request.json();
  const { eventId, title } = body as { eventId?: string; title?: string };
  if (!eventId || !title?.trim()) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const role = getPrimaryAdminRole(authResult.user.roles);
  const canEdit = ["ADMINISTRATOR", "ADMIN_PUSAT", "ADMIN_PROVINCE", "ADMIN_BRANCH", "ADMIN"].includes(role);
  if (!canEdit) {
    return NextResponse.json({ error: "Hanya admin cabang yang dapat mengubah label periode" }, { status: 403 });
  }

  const event = await prisma.event.findFirst({
    where: { id: eventId, ...buildEventFilter(authResult.user), isDeleted: false },
  });
  if (!event) {
    return NextResponse.json({ error: "Periode UKT tidak ditemukan" }, { status: 404 });
  }

  const updated = await prisma.event.update({
    where: { id: eventId },
    data: { title: title.trim() },
  });

  return NextResponse.json({ event: updated });
}
