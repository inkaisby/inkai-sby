import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { formatRankLabel, isBlackBeltRank } from "@/lib/belt";
import { resolveMemberPhotoUrl } from "@/lib/member-photo";
import { prisma, withPrismaFallback } from "@/lib/prisma";
import { memberPhotoSelect } from "@/lib/prisma-columns";
import { buildMemberFilter } from "@/lib/rbac";
import { rateLimitAsync, rateLimitResponse } from "@/lib/security/rate-limit";
import { forbidWasitJuriAction } from "@/lib/wasit-juri-data";

export const dynamic = "force-dynamic";

const suggestQuerySchema = z.object({
  q: z.string().trim().max(64).optional().default(""),
  nias: z.string().trim().max(600).optional().default(""),
});

function computeAgeFromBirthDate(birthDate: Date | null): number | null {
  if (!birthDate || Number.isNaN(birthDate.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const monthDiff = now.getMonth() - birthDate.getMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && now.getDate() < birthDate.getDate())
  ) {
    age -= 1;
  }
  return age >= 0 && age <= 110 ? age : null;
}

export async function GET(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  const denied = forbidWasitJuriAction(
    authResult.user,
    authResult.adminDojoGrants,
    "read",
  );
  if (denied) return denied;

  const rlKey = `wasit-juri:member-suggest:${authResult.user.id}`;
  const limited = await rateLimitAsync(rlKey, { max: 60, windowMs: 60_000 });
  if (!limited.success) {
    return rateLimitResponse(limited.retryAfterSec ?? 60, rlKey);
  }

  const { searchParams } = new URL(request.url);
  const parsed = suggestQuerySchema.safeParse({
    q: searchParams.get("q") ?? undefined,
    nias: searchParams.get("nias") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ suggestions: [] });
  }

  const q = parsed.data.q;
  const niaList = parsed.data.nias
    ? parsed.data.nias
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 30)
    : [];

  if (q.length < 2 && niaList.length === 0) {
    return NextResponse.json({ suggestions: [] });
  }

  const photoSelect = await memberPhotoSelect();

  const searchFilter =
    niaList.length > 0 && q.length < 2
      ? { nia: { in: niaList } }
      : {
          OR: [
            { fullName: { contains: q, mode: "insensitive" as const } },
            { nia: { contains: q, mode: "insensitive" as const } },
            { mshNumber: { contains: q, mode: "insensitive" as const } },
            { dojo: { name: { contains: q, mode: "insensitive" as const } } },
          ],
        };

  const { data: members } = await withPrismaFallback(
    "wasit-juri-member-suggest",
    () =>
      prisma.member.findMany({
        where: {
          AND: [
            { isDeleted: false },
            buildMemberFilter(authResult.user),
            searchFilter,
          ],
        },
        select: {
          id: true,
          fullName: true,
          nia: true,
          mshNumber: true,
          currentRank: true,
          birthDate: true,
          birthCertificateUrl: true,
          bpjsCardUrl: true,
          bpjsCardNumber: true,
          ...photoSelect,
          user: { select: { photoUrl: true } },
          dojo: { select: { id: true, name: true } },
          wasitJuriRegistrations: {
            where: { status: "LULUS" },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              grantedLicense: true,
              targetGrade: true,
              discipline: true,
              licenseValidUntil: true,
              danCertificateUrl: true,
              licenseCertUrl: true,
            },
          },
        },
        take: niaList.length > 0 && q.length < 2 ? 30 : 20,
        orderBy: { fullName: "asc" },
      }),
    [],
  );

  // Utamakan pemegang Sabuk Hitam / DAN di urutan atas hasil pencarian.
  const sorted = [...members].sort((a, b) => {
    const aDan = isBlackBeltRank(a.currentRank) ? 0 : 1;
    const bDan = isBlackBeltRank(b.currentRank) ? 0 : 1;
    if (aDan !== bDan) return aDan - bDan;
    return a.fullName.localeCompare(b.fullName, "id");
  });

  const limit = niaList.length > 0 && q.length < 2 ? 30 : 12;

  return NextResponse.json({
    suggestions: sorted.slice(0, limit).map((m) => {
      const rawPhoto = (m as { photoUrl?: string | null }).photoUrl;
      const latestGrad = m.wasitJuriRegistrations?.[0] ?? null;
      return {
        id: m.id,
        fullName: m.fullName,
        nia: m.nia ?? null,
        mshNumber: m.mshNumber ?? null,
        currentRank: formatRankLabel(m.currentRank) || m.currentRank || "",
        isBlackBelt: isBlackBeltRank(m.currentRank),
        birthDate: m.birthDate ? m.birthDate.toISOString().slice(0, 10) : null,
        age: computeAgeFromBirthDate(m.birthDate),
        dojoId: m.dojo?.id ?? null,
        dojoName: m.dojo?.name ?? "",
        photoUrl: resolveMemberPhotoUrl(rawPhoto, m.user?.photoUrl),
        birthCertificateUrl: m.birthCertificateUrl?.trim() || null,
        bpjsCardUrl: m.bpjsCardUrl?.trim() || null,
        bpjsCardNumber: m.bpjsCardNumber?.trim() || null,
        latestLicense: latestGrad?.grantedLicense?.trim() || null,
        latestTargetGrade: latestGrad?.targetGrade || null,
        latestLicenseValidUntil: latestGrad?.licenseValidUntil
          ? latestGrad.licenseValidUntil.toISOString().slice(0, 10)
          : null,
        latestDanCertificateUrl: latestGrad?.danCertificateUrl?.trim() || null,
        latestLicenseCertUrl: latestGrad?.licenseCertUrl?.trim() || null,
      };
    }),
  });
}
