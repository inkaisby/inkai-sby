import { prisma } from "@/lib/prisma";

type AuditParams = {
  userId?: string | null;
  email?: string | null;
  action: string;
  details?: string;
  ip?: string | null;
  userAgent?: string | null;
};

export async function writeAuditLog(params: AuditParams) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId ?? undefined,
        email: params.email ?? undefined,
        action: params.action,
        details: params.details,
        ip: params.ip ?? undefined,
        userAgent: params.userAgent ?? undefined,
      },
    });
  } catch {
    // Audit failure must not break primary flow
  }
}
