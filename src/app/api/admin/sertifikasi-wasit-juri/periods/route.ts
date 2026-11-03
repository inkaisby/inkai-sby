import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { rateLimitAsync, rateLimitResponse } from "@/lib/security/rate-limit";
import {
  canUserManageWasitJuriPeriod,
  forbidWasitJuriAction,
  serializeWasitJuriPeriod,
  writeWasitJuriAudit,
} from "@/lib/wasit-juri-data";

export const dynamic = "force-dynamic";

const createPeriodSchema = z.object({
  title: z.string().trim().min(3, "Judul periode minimal 3 karakter").max(180),
  levelScope: z.enum(["Cabang", "Pengprov Jatim", "PB INKAI / FORKI"]).default("Cabang"),
  theoryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal teori tidak valid"),
  practicalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal praktik tidak valid"),
  closeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Batas pendaftaran tidak valid"),
  location: z.string().trim().min(2, "Lokasi wajib diisi").max(180),
  quota: z.coerce.number().int().min(1).max(1000).default(50),
  feeNew: z.coerce.number().int().min(0).max(50_000_000).default(350_000),
  feeUpgrade: z.coerce.number().int().min(0).max(50_000_000).default(300_000),
  feeRefreshing: z.coerce.number().int().min(0).max(50_000_000).default(200_000),
  archivePrevious: z.boolean().optional().default(true),
});

export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  const denied = forbidWasitJuriAction(
    authResult.user,
    authResult.adminDojoGrants,
    "create",
  );
  if (denied) return denied;

  if (!canUserManageWasitJuriPeriod(authResult.user)) {
    return NextResponse.json(
      { error: "Hanya pengurus Cabang / Pengprov / Pusat yang dapat membuat periode sertifikasi." },
      { status: 403 },
    );
  }

  const rlKey = `wasit-juri:period-create:${authResult.user.id}`;
  const limited = await rateLimitAsync(rlKey, { max: 20, windowMs: 60_000 });
  if (!limited.success) {
    return rateLimitResponse(limited.retryAfterSec ?? 60, rlKey);
  }

  const body = await request.json().catch(() => null);
  const parsed = createPeriodSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Data periode tidak valid." },
      { status: 400 },
    );
  }

  const d = parsed.data;
  const nowDate = new Date();

  try {
    const created = await prisma.$transaction(async (tx) => {
      if (d.archivePrevious) {
        await tx.wasitJuriPeriod.updateMany({
          where: { isArchived: false },
          data: { isArchived: true, archivedAt: nowDate },
        });
      }

      return tx.wasitJuriPeriod.create({
        data: {
          title: d.title,
          levelScope: d.levelScope,
          theoryDate: new Date(`${d.theoryDate}T00:00:00.000Z`),
          practicalDate: new Date(`${d.practicalDate}T00:00:00.000Z`),
          closeDate: new Date(`${d.closeDate}T00:00:00.000Z`),
          location: d.location,
          quota: d.quota,
          feeNew: d.feeNew,
          feeUpgrade: d.feeUpgrade,
          feeRefreshing: d.feeRefreshing,
          isArchived: false,
          archivedAt: null,
          branchId: authResult.user.managedBranchId ?? null,
          createdById: authResult.user.id,
        },
      });
    });

    writeWasitJuriAudit({
      user: authResult.user,
      token: authResult.token,
      request,
      action: "WASIT_JURI_PERIOD_CREATE",
      details: `periodId=${created.id} title="${created.title}" scope=${created.levelScope} quota=${created.quota}`,
    });

    const allPeriods = await prisma.wasitJuriPeriod.findMany({
      orderBy: [{ practicalDate: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({
      period: serializeWasitJuriPeriod(created),
      periods: allPeriods.map(serializeWasitJuriPeriod),
    });
  } catch (err) {
    console.error("[wasit-juri] POST periods failed:", err);
    return NextResponse.json(
      { error: "Gagal menyimpan periode baru ke database." },
      { status: 500 },
    );
  }
}
