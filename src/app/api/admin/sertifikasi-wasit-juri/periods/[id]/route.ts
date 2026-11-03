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

const patchPeriodSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.enum(["archive", "restore"]),
  }),
  z.object({
    action: z.literal("edit"),
    title: z.string().trim().min(3, "Judul periode minimal 3 karakter").max(180),
    levelScope: z.enum(["Cabang", "Pengprov Jatim", "PB INKAI / FORKI"]),
    theoryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal teori tidak valid"),
    practicalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal praktik tidak valid"),
    closeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Batas pendaftaran tidak valid"),
    location: z.string().trim().min(2, "Lokasi wajib diisi").max(180),
    quota: z.coerce.number().int().min(1).max(1000),
    feeNew: z.coerce.number().int().min(0).max(50_000_000),
    feeUpgrade: z.coerce.number().int().min(0).max(50_000_000),
    feeRefreshing: z.coerce.number().int().min(0).max(50_000_000),
  }),
]);

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  const denied = forbidWasitJuriAction(
    authResult.user,
    authResult.adminDojoGrants,
    "update",
  );
  if (denied) return denied;

  if (!canUserManageWasitJuriPeriod(authResult.user)) {
    return NextResponse.json(
      { error: "Hanya pengurus Cabang / Pengprov / Pusat yang dapat mengubah pengaturan periode." },
      { status: 403 },
    );
  }

  const rlKey = `wasit-juri:period-patch:${authResult.user.id}`;
  const limited = await rateLimitAsync(rlKey, { max: 30, windowMs: 60_000 });
  if (!limited.success) {
    return rateLimitResponse(limited.retryAfterSec ?? 60, rlKey);
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = patchPeriodSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Data perubahan periode tidak valid." },
      { status: 400 },
    );
  }

  try {
    const existing = await prisma.wasitJuriPeriod.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Periode sertifikasi tidak ditemukan." },
        { status: 404 },
      );
    }

    if (parsed.data.action !== "edit") {
      const actionType = parsed.data.action;
      const updated = await prisma.wasitJuriPeriod.update({
        where: { id },
        data:
          actionType === "archive"
            ? { isArchived: true, archivedAt: new Date() }
            : { isArchived: false, archivedAt: null },
      });

      writeWasitJuriAudit({
        user: authResult.user,
        token: authResult.token,
        request,
        action:
          actionType === "archive"
            ? "WASIT_JURI_PERIOD_ARCHIVE"
            : "WASIT_JURI_PERIOD_RESTORE",
        details: `periodId=${id} title="${updated.title}"`,
      });

      return NextResponse.json({
        period: serializeWasitJuriPeriod(updated),
      });
    }

    if (existing.isArchived) {
      return NextResponse.json(
        { error: "Periode yang sudah diarsipkan harus dibuka kembali sebelum diedit." },
        { status: 400 },
      );
    }

    const d = parsed.data;
    const updated = await prisma.$transaction(async (tx) => {
      const p = await tx.wasitJuriPeriod.update({
        where: { id },
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
        },
      });

      // Sinkronkan tagihan peserta yang masih BELUM_BAYAR jika nominal biaya diubah;
      // peserta MENUNGGU_VERIFIKASI / LUNAS tetap terkunci pada snapshot saat bayar.
      if (d.feeNew !== existing.feeNew) {
        await tx.wasitJuriRegistration.updateMany({
          where: { periodId: id, paymentState: "BELUM_BAYAR", submissionType: "BARU" },
          data: { feeAmount: d.feeNew },
        });
      }
      if (d.feeUpgrade !== existing.feeUpgrade) {
        await tx.wasitJuriRegistration.updateMany({
          where: { periodId: id, paymentState: "BELUM_BAYAR", submissionType: "KENAIKAN" },
          data: { feeAmount: d.feeUpgrade },
        });
      }
      if (d.feeRefreshing !== existing.feeRefreshing) {
        await tx.wasitJuriRegistration.updateMany({
          where: { periodId: id, paymentState: "BELUM_BAYAR", submissionType: "REFRESHING" },
          data: { feeAmount: d.feeRefreshing },
        });
      }

      return p;
    });

    writeWasitJuriAudit({
      user: authResult.user,
      token: authResult.token,
      request,
      action: "WASIT_JURI_PERIOD_EDIT",
      details: `periodId=${id} title="${updated.title}" closeDate=${d.closeDate} quota=${d.quota}`,
    });

    return NextResponse.json({
      period: serializeWasitJuriPeriod(updated),
      feesSynced:
        d.feeNew !== existing.feeNew ||
        d.feeUpgrade !== existing.feeUpgrade ||
        d.feeRefreshing !== existing.feeRefreshing,
    });
  } catch (err) {
    console.error("[wasit-juri] PATCH period failed:", err);
    return NextResponse.json(
      { error: "Gagal memperbarui periode di database." },
      { status: 500 },
    );
  }
}
