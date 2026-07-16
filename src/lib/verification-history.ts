import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildMemberFilter, type SessionUser } from "@/lib/rbac";

export const VERIFICATION_TYPE_LABELS: Record<string, string> = {
  RANK_UPGRADE: "Kenaikan Sabuk",
  RANK_PROMOTION: "Kenaikan Sabuk",
  TRANSFER: "Pindah Dojo",
  DOJO_TRANSFER: "Pindah Dojo",
  DOCUMENT: "Dokumen",
  ACHIEVEMENT: "Prestasi",
  MONTHLY_IURAN: "Iuran Bulanan",
  PASSWORD_RESET: "Reset Password",
};

export const VERIFICATION_HISTORY_TYPES = [
  "PASSWORD_RESET",
  "RANK_PROMOTION",
  "RANK_UPGRADE",
  "DOJO_TRANSFER",
  "TRANSFER",
  "DOCUMENT",
  "ACHIEVEMENT",
  "MONTHLY_IURAN",
] as const;

export type VerificationHistoryRow = {
  id: string;
  type: string;
  status: string;
  data: string;
  adminNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
  member: {
    fullName: string;
    nia: string | null;
    dojo: { name: string } | null;
  } | null;
};

export async function fetchVerificationHistory(
  user: SessionUser,
  opts: {
    q?: string;
    status?: string;
    type?: string;
    page?: number;
    limit?: number;
  } = {},
) {
  const page = Math.max(1, opts.page ?? 1);
  const limit = Math.min(50, Math.max(5, opts.limit ?? 20));
  const q = opts.q?.trim() || "";
  const status = opts.status?.trim() || "";
  const type = opts.type?.trim() || "";

  const memberScope = buildMemberFilter(user);

  const memberWhere: Prisma.MemberWhereInput = {
    ...memberScope,
    ...(q
      ? {
          OR: [
            { fullName: { contains: q, mode: "insensitive" } },
            { nia: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const where: Prisma.VerificationWhereInput = {
    status: status
      ? status
      : { in: ["APPROVED", "REJECTED"] },
    ...(type ? { type } : {}),
    member: memberWhere,
  };

  const [total, rows] = await Promise.all([
    prisma.verification.count({ where }),
    prisma.verification.findMany({
      where,
      include: {
        member: {
          select: {
            fullName: true,
            nia: true,
            dojo: { select: { name: true } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return {
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    rows: rows as VerificationHistoryRow[],
  };
}

export function parseResetEmail(data: string | null | undefined): string | null {
  if (!data) return null;
  try {
    const parsed = JSON.parse(data) as { email?: string };
    return parsed.email ?? null;
  } catch {
    return null;
  }
}
