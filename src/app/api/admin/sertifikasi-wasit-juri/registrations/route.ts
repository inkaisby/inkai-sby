import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { isBlackBeltRank } from "@/lib/belt";
import { ymdWib } from "@/lib/kas";
import { resolveMemberPhotoUrl } from "@/lib/member-photo";
import { prisma } from "@/lib/prisma";
import { memberPhotoSelect } from "@/lib/prisma-columns";
import { buildMemberFilter } from "@/lib/rbac";
import { rateLimitAsync, rateLimitResponse } from "@/lib/security/rate-limit";
import {
  canUserManageWasitJuriPeriod,
  forbidWasitJuriAction,
  mapMemberRankToDan,
  serializeWasitJuriRegistration,
  wasitJuriRegistrationInclude,
  writeWasitJuriAudit,
} from "@/lib/wasit-juri-data";

export const dynamic = "force-dynamic";

const createRegistrationSchema = z.object({
  periodId: z.string().uuid("Periode sertifikasi tidak valid"),
  memberId: z.string().uuid("Pilih anggota yang terdaftar di Keanggotaan"),
  danRank: z.string().trim().max(32).optional(),
  mshNumber: z.string().trim().max(64).optional(),
  submissionType: z.enum(["BARU", "KENAIKAN", "REFRESHING"]).default("BARU"),
  currentLicense: z.string().trim().max(160).optional().nullable(),
  targetGrade: z.enum(["JURI_B", "JURI_A", "WASIT_B", "WASIT_A"]).default("JURI_B"),
  discipline: z.enum(["KATA_KUMITE", "KUMITE", "KATA"]).default("KATA_KUMITE"),
  paymentMethod: z.enum(["TRANSFER", "TUNAI"]).optional().default("TRANSFER"),
  proofUrl: z.string().trim().max(600).optional().nullable(),
  danCertificateUrl: z.string().trim().max(600).optional().nullable(),
  licenseCertUrl: z.string().trim().max(600).optional().nullable(),
  notes: z.string().trim().max(400).optional().nullable(),
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

  const rlKey = `wasit-juri:reg-create:${authResult.user.id}`;
  const limited = await rateLimitAsync(rlKey, { max: 30, windowMs: 60_000 });
  if (!limited.success) {
    return rateLimitResponse(limited.retryAfterSec ?? 60, rlKey);
  }

  const body = await request.json().catch(() => null);
  const parsed = createRegistrationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Data pendaftaran tidak valid." },
      { status: 400 },
    );
  }

  const d = parsed.data;
  const canManage = canUserManageWasitJuriPeriod(authResult.user);

  try {
    const period = await prisma.wasitJuriPeriod.findUnique({
      where: { id: d.periodId },
    });
    if (!period) {
      return NextResponse.json(
        { error: "Periode sertifikasi tidak ditemukan." },
        { status: 404 },
      );
    }
    if (period.isArchived) {
      return NextResponse.json(
        { error: "Periode ini sudah berada di Arsip Riwayat (terkunci)." },
        { status: 400 },
      );
    }

    if (!canManage) {
      const todayYmd = ymdWib();
      const closeYmd = period.closeDate.toISOString().slice(0, 10);
      if (closeYmd && todayYmd > closeYmd) {
        return NextResponse.json(
          {
            error: `Batas pendaftaran ranting telah ditutup pada ${closeYmd}. Hubungi pengurus Cabang untuk pengajuan susulan.`,
          },
          { status: 400 },
        );
      }

      const currentCount = await prisma.wasitJuriRegistration.count({
        where: { periodId: period.id },
      });
      if (currentCount >= period.quota) {
        return NextResponse.json(
          {
            error: `Kuota peserta periode ini telah penuh (${currentCount}/${period.quota}). Hubungi pengurus Cabang bila membutuhkan tambahan kuota.`,
          },
          { status: 400 },
        );
      }
    }

    const photoSelect = await memberPhotoSelect();
    const member = await prisma.member.findFirst({
      where: {
        id: d.memberId,
        isDeleted: false,
        ...buildMemberFilter(authResult.user),
      },
      select: {
        id: true,
        fullName: true,
        nia: true,
        dojoId: true,
        currentRank: true,
        mshNumber: true,
        birthCertificateUrl: true,
        bpjsCardUrl: true,
        ...photoSelect,
        user: { select: { photoUrl: true } },
      },
    });

    if (!member) {
      return NextResponse.json(
        { error: "Anggota tidak ditemukan atau berada di luar cakupan wilayah Anda." },
        { status: 404 },
      );
    }

    const rankText = `${member.currentRank || ""} ${d.danRank || ""}`;
    const eligibleRank =
      isBlackBeltRank(member.currentRank) ||
      /coklat|cokelat|kyu\s*1\b|dan\b|hitam/i.test(rankText);
    if (!canManage && !eligibleRank) {
      return NextResponse.json(
        {
          error:
            "Pendaftaran Wasit/Juri mensyaratkan minimal Sabuk Coklat (Kyu 1) atau Sabuk Hitam (DAN). Perbarui tingkatan sabuk anggota terlebih dahulu.",
        },
        { status: 400 },
      );
    }

    const providedMsh = d.mshNumber?.trim() || null;
    if (providedMsh && !member.mshNumber) {
      await prisma.member
        .updateMany({
          where: { id: member.id, mshNumber: null },
          data: { mshNumber: providedMsh },
        })
        .catch(() => {});
    }

    const feeAmount =
      d.submissionType === "BARU"
        ? period.feeNew
        : d.submissionType === "KENAIKAN"
          ? period.feeUpgrade
          : period.feeRefreshing;

    const rawPhoto = (member as { photoUrl?: string | null }).photoUrl;
    const resolvedPhoto = resolveMemberPhotoUrl(rawPhoto, member.user?.photoUrl);
    const cleanProof = d.proofUrl?.trim() || null;
    const cleanDanCert = d.danCertificateUrl?.trim() || null;
    const cleanLicenseCert = d.licenseCertUrl?.trim() || null;
    const cleanPriorLicense =
      d.submissionType === "BARU" ? null : d.currentLicense?.trim() || null;

    const needsPriorLicense =
      d.submissionType === "KENAIKAN" || d.submissionType === "REFRESHING";
    const docsComplete = Boolean(
      resolvedPhoto &&
        member.birthCertificateUrl?.trim() &&
        member.bpjsCardUrl?.trim() &&
        (!needsPriorLicense || cleanLicenseCert || cleanPriorLicense),
    );

    const include = await wasitJuriRegistrationInclude();
    const created = await prisma.wasitJuriRegistration.create({
      data: {
        periodId: period.id,
        memberId: member.id,
        dojoId: member.dojoId,
        registeredByUserId: authResult.user.id,
        danRankSnapshot: d.danRank || mapMemberRankToDan(member.currentRank),
        mshNumberSnapshot: member.mshNumber || providedMsh,
        submissionType: d.submissionType,
        currentLicense: cleanPriorLicense,
        targetGrade: d.targetGrade,
        discipline: d.discipline,
        feeAmount,
        paymentMethod: d.paymentMethod,
        proofUrl: cleanProof,
        danCertificateUrl: cleanDanCert,
        licenseCertUrl: cleanLicenseCert,
        notes: d.notes?.trim() || null,
        paymentState: cleanProof ? "MENUNGGU_VERIFIKASI" : "BELUM_BAYAR",
        status: docsComplete ? "MENUNGGU_BAYAR" : "MENUNGGU_BERKAS",
      },
      include,
    });

    writeWasitJuriAudit({
      user: authResult.user,
      token: authResult.token,
      request,
      action: "WASIT_JURI_REG_CREATE",
      details: `regId=${created.id} periodId=${period.id} member="${member.fullName}" type=${d.submissionType} target=${d.targetGrade} fee=${feeAmount}`,
    });

    return NextResponse.json({
      registration: serializeWasitJuriRegistration(
        created as unknown as Parameters<typeof serializeWasitJuriRegistration>[0],
      ),
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Anggota ini sudah terdaftar pada periode sertifikasi tersebut." },
        { status: 409 },
      );
    }
    console.error("[wasit-juri] POST registration failed:", err);
    return NextResponse.json(
      { error: "Gagal menyimpan pendaftaran ke database." },
      { status: 500 },
    );
  }
}
