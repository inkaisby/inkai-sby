import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { buildMemberFilter } from "@/lib/rbac";
import { notifyUser } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const broadcastSchema = z.object({
  title: z.string().trim().min(1).max(120),
  content: z.string().trim().min(1).max(2000),
  scope: z.enum(["all", "dojo"]).default("all"),
  dojoId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  const parsed = broadcastSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Data broadcast tidak valid" }, { status: 400 });
  }

  const { title, content, scope, dojoId } = parsed.data;
  if (scope === "dojo" && !dojoId) {
    return NextResponse.json({ error: "Pilih ranting untuk broadcast" }, { status: 400 });
  }

  const memberWhere = {
    ...buildMemberFilter(authResult.user),
    status: "ACTIVE" as const,
    userId: { not: null },
    ...(scope === "dojo" && dojoId ? { dojoId } : {}),
  };

  const members = await prisma.member.findMany({
    where: memberWhere,
    select: { userId: true },
    take: 2000,
  });

  const userIds = [
    ...new Set(
      members
        .map((m) => m.userId)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  ];

  if (userIds.length === 0) {
    return NextResponse.json(
      { error: "Tidak ada anggota aktif dengan akun untuk dikirimi notifikasi" },
      { status: 400 },
    );
  }

  let sent = 0;
  let failed = 0;
  for (const userId of userIds) {
    try {
      await notifyUser({
        userId,
        title,
        content,
        type: "INFO",
        token: authResult.token,
      });
      sent += 1;
    } catch {
      failed += 1;
    }
  }

  return NextResponse.json({
    message: `Broadcast terkirim ke ${sent} anggota${failed ? ` (${failed} gagal)` : ""}`,
    sent,
    failed,
    total: userIds.length,
  });
}
