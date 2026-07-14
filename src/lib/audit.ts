import { prisma } from "@/lib/prisma";

type AuditParams = {
  userId?: string | null;
  email?: string | null;
  action: string;
  details?: string;
  ip?: string | null;
  userAgent?: string | null;
};

/** Fire-and-forget — never blocks API response. */
export function writeAuditLog(params: AuditParams): void {
  prisma.auditLog
    .create({
      data: {
        userId: params.userId ?? undefined,
        email: params.email ?? undefined,
        action: params.action,
        details: params.details,
        ip: params.ip ?? undefined,
        userAgent: params.userAgent ?? undefined,
      },
    })
    .catch(() => {});
}
