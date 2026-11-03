import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import {
  postKasFromWasitJuriPaid,
  voidKasFromWasitJuri,
} from "@/lib/kas-hooks";
import { prisma } from "@/lib/prisma";
import { buildMemberFilter } from "@/lib/rbac";
import { rateLimitAsync, rateLimitResponse } from "@/lib/security/rate-limit";
import {
  canUserManageWasitJuriPeriod,
  defaultLicenseExpiryYmd,
  forbidWasitJuriAction,
  serializeWasitJuriRegistration,
  wasitJuriRegistrationInclude,
  writeWasitJuriAudit,
} from "@/lib/wasit-juri-data";

export const dynamic = "force-dynamic";

const patchRegistrationSchema = z.object({
  paymentState: z
    .enum(["BELUM_BAYAR", "MENUNGGU_VERIFIKASI", "LUNAS"])
    .optional(),
  paymentMethod: z.enum(["TRANSFER", "TUNAI"]).optional(),
  proofUrl: z.string().trim().max(600).nullable().optional(),
  danCertificateUrl: z.string().trim().max(600).nullable().optional(),
  licenseCertUrl: z.string().trim().max(600).nullable().optional(),
  notes: z.string().trim().max(400).nullable().optional(),
  status: z
    .enum([
      "MENUNGGU_BERKAS",
      "MENUNGGU_BAYAR",
      "SIAP_UJIAN",
      "LULUS",
      "MENGULANG",
    ])
    .optional(),
  scoreTeoriKata: z.number().int().min(0).max(100).nullable().optional(),
  scoreTeoriKumite: z.number().int().min(0).max(100).nullable().optional(),
  scorePraktik: z.number().int().min(0).max(100).nullable().optional(),
  grantedLicense: z.string().trim().max(180).nullable().optional(),
  licenseValidUntil: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal masa berlaku tidak valid")
    .nullable()
    .optional(),
});

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

  const rlKey = `wasit-juri:reg-patch:${authResult.user.id}`;
  const limited = await rateLimitAsync(rlKey, { max: 40, windowMs: 60_000 });
  if (!limited.success) {
    return rateLimitResponse(limited.retryAfterSec ?? 60, rlKey);
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = patchRegistrationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Perubahan tidak valid." },
      { status: 400 },
    );
  }

  const d = parsed.data;
  const canManage = canUserManageWasitJuriPeriod(authResult.user);

  if (
    !canManage &&
    (d.paymentState === "LUNAS" ||
      d.status === "SIAP_UJIAN" ||
      d.status === "LULUS" ||
      d.status === "MENGULANG" ||
      d.scoreTeoriKata !== undefined ||
      d.scoreTeoriKumite !== undefined ||
      d.scorePraktik !== undefined ||
      d.grantedLicense !== undefined ||
      d.licenseValidUntil !== undefined)
  ) {
    return NextResponse.json(
      { error: "Verifikasi pembayaran dan penilaian ujian hanya dapat dilakukan pengurus Cabang / Pengprov." },
      { status: 403 },
    );
  }

  try {
    const existing = await prisma.wasitJuriRegistration.findFirst({
      where: {
        id,
        member: {
          isDeleted: false,
          ...buildMemberFilter(authResult.user),
        },
      },
      include: {
        period: {
          select: {
            id: true,
            title: true,
            practicalDate: true,
            isArchived: true,
          },
        },
        member: {
          select: {
            id: true,
            fullName: true,
            nia: true,
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Data pendaftaran tidak ditemukan." },
        { status: 404 },
      );
    }

    if (existing.period.isArchived) {
      return NextResponse.json(
        { error: "Periode ini sudah diarsipkan (mode baca saja). Buka kembali periode jika perlu koreksi." },
        { status: 400 },
      );
    }

    if (!canManage && existing.paymentState === "LUNAS" && d.paymentState !== undefined) {
      return NextResponse.json(
        { error: "Status pembayaran yang sudah Lunas tidak dapat diubah oleh Ranting." },
        { status: 403 },
      );
    }

    let resolvedValidUntil: Date | null | undefined = undefined;
    if (d.licenseValidUntil !== undefined) {
      resolvedValidUntil = d.licenseValidUntil
        ? new Date(`${d.licenseValidUntil}T00:00:00.000Z`)
        : null;
    } else if (d.status === "LULUS" && !existing.licenseValidUntil) {
      const practicalYmd = existing.period.practicalDate.toISOString().slice(0, 10);
      resolvedValidUntil = new Date(
        `${defaultLicenseExpiryYmd(practicalYmd, 3)}T00:00:00.000Z`,
      );
    } else if (d.status && d.status !== "LULUS" && d.grantedLicense === null) {
      resolvedValidUntil = null;
    }

    const include = await wasitJuriRegistrationInclude();
    const updated = await prisma.wasitJuriRegistration.update({
      where: { id },
      data: {
        ...(d.paymentState !== undefined ? { paymentState: d.paymentState } : {}),
        ...(d.paymentMethod !== undefined ? { paymentMethod: d.paymentMethod } : {}),
        ...(d.proofUrl !== undefined ? { proofUrl: d.proofUrl || null } : {}),
        ...(d.danCertificateUrl !== undefined
          ? { danCertificateUrl: d.danCertificateUrl || null }
          : {}),
        ...(d.licenseCertUrl !== undefined
          ? { licenseCertUrl: d.licenseCertUrl || null }
          : {}),
        ...(d.notes !== undefined ? { notes: d.notes || null } : {}),
        ...(d.status !== undefined ? { status: d.status } : {}),
        ...(d.scoreTeoriKata !== undefined
          ? { scoreTeoriKata: d.scoreTeoriKata }
          : {}),
        ...(d.scoreTeoriKumite !== undefined
          ? { scoreTeoriKumite: d.scoreTeoriKumite }
          : {}),
        ...(d.scorePraktik !== undefined ? { scorePraktik: d.scorePraktik } : {}),
        ...(d.grantedLicense !== undefined
          ? { grantedLicense: d.grantedLicense || null }
          : {}),
        ...(resolvedValidUntil !== undefined
          ? { licenseValidUntil: resolvedValidUntil }
          : {}),
      },
      include,
    });

    let kasWarning: string | undefined;
    if (existing.paymentState !== "LUNAS" && updated.paymentState === "LUNAS") {
      const kasRes = await postKasFromWasitJuriPaid({
        user: authResult.user,
        registrationId: updated.id,
        feeAmount: updated.feeAmount,
        submissionType: updated.submissionType,
        paymentMethod: updated.paymentMethod,
        memberName: existing.member.fullName,
        memberNia: existing.member.nia,
        periodTitle: existing.period.title,
        dojoId: updated.dojoId,
      });
      if (kasRes.warning) kasWarning = kasRes.warning;
    } else if (existing.paymentState === "LUNAS" && updated.paymentState !== "LUNAS") {
      const voidRes = await voidKasFromWasitJuri(updated.id, authResult.user.id);
      if (voidRes.warning) kasWarning = voidRes.warning;
    }

    writeWasitJuriAudit({
      user: authResult.user,
      token: authResult.token,
      request,
      action: "WASIT_JURI_REG_UPDATE",
      details: `regId=${id} member="${existing.member.fullName}" pay=${updated.paymentState} status=${updated.status}${updated.grantedLicense ? ` license="${updated.grantedLicense}"` : ""}`,
    });

    return NextResponse.json({
      registration: serializeWasitJuriRegistration(
        updated as unknown as Parameters<typeof serializeWasitJuriRegistration>[0],
      ),
      ...(kasWarning ? { kasWarning } : {}),
    });
  } catch (err) {
    console.error("[wasit-juri] PATCH registration failed:", err);
    return NextResponse.json(
      { error: "Gagal menyimpan perubahan pendaftaran." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  const denied = forbidWasitJuriAction(
    authResult.user,
    authResult.adminDojoGrants,
    "delete",
  );
  if (denied) return denied;

  const rlKey = `wasit-juri:reg-del:${authResult.user.id}`;
  const limited = await rateLimitAsync(rlKey, { max: 20, windowMs: 60_000 });
  if (!limited.success) {
    return rateLimitResponse(limited.retryAfterSec ?? 60, rlKey);
  }

  const { id } = await context.params;
  const canManage = canUserManageWasitJuriPeriod(authResult.user);

  try {
    const existing = await prisma.wasitJuriRegistration.findFirst({
      where: {
        id,
        member: {
          isDeleted: false,
          ...buildMemberFilter(authResult.user),
        },
      },
      include: {
        period: { select: { title: true, isArchived: true } },
        member: { select: { fullName: true } },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Data pendaftaran tidak ditemukan." },
        { status: 404 },
      );
    }

    if (existing.period.isArchived) {
      return NextResponse.json(
        { error: "Pendaftaran di Arsip Riwayat terkunci dan tidak dapat dihapus." },
        { status: 400 },
      );
    }

    if (!canManage && existing.paymentState === "LUNAS") {
      return NextResponse.json(
        { error: "Pendaftaran yang sudah Lunas hanya dapat dibatalkan oleh pengurus Cabang." },
        { status: 403 },
      );
    }

    await prisma.wasitJuriRegistration.delete({ where: { id } });

    let kasWarning: string | undefined;
    if (existing.paymentState === "LUNAS") {
      const voidRes = await voidKasFromWasitJuri(id, authResult.user.id);
      if (voidRes.warning) kasWarning = voidRes.warning;
    }

    writeWasitJuriAudit({
      user: authResult.user,
      token: authResult.token,
      request,
      action: "WASIT_JURI_REG_DELETE",
      details: `regId=${id} member="${existing.member.fullName}" period="${existing.period.title}" wasPaid=${existing.paymentState === "LUNAS"}`,
    });

    return NextResponse.json({
      deletedId: id,
      ...(kasWarning ? { kasWarning } : {}),
    });
  } catch (err) {
    console.error("[wasit-juri] DELETE registration failed:", err);
    return NextResponse.json(
      { error: "Gagal menghapus pendaftaran dari database." },
      { status: 500 },
    );
  }
}
