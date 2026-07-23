import { getInkaiApiBaseUrl } from "@/lib/inkai-api/server";
import { prisma } from "@/lib/prisma";

type AuditParams = {
  userId?: string | null;
  email?: string | null;
  action: string;
  details?: string;
  ip?: string | null;
  userAgent?: string | null;
  token?: string | null;
};

export type BillingAuditMeta = {
  memberId?: string | null;
  billingId?: string | null;
  billingAction?: string | null;
  notes?: string | null;
  amount?: number | null;
};

/** Format details agar bisa dicari per anggota di Prisma AuditLog. */
export function formatBillingAuditDetails(
  meta: BillingAuditMeta,
  extra?: string,
): string {
  const parts = [
    meta.memberId ? `memberId=${meta.memberId}` : null,
    meta.billingId ? `billingId=${meta.billingId}` : null,
    meta.billingAction ? `billingAction=${meta.billingAction}` : null,
    meta.amount != null && Number.isFinite(meta.amount)
      ? `amount=${Math.round(meta.amount)}`
      : null,
    meta.notes?.trim() ? `notes=${meta.notes.trim().slice(0, 200)}` : null,
    extra?.trim() || null,
  ].filter(Boolean);
  return parts.join(" ");
}

/** Fire-and-forget — never blocks API response. */
export function writeAuditLog(params: AuditParams): void {
  const token = params.token;
  if (!token) return;

  fetch(`${getInkaiApiBaseUrl()}/v1/audit-logs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      action: params.action,
      details: params.details,
      ip: params.ip ?? undefined,
      userAgent: params.userAgent ?? undefined,
    }),
  }).catch(() => {});
}

/**
 * Jejak lokal untuk UI rekening iuran (dual-write dengan Inkai audit).
 * Fire-and-forget — jangan await di hot path kecuali perlu.
 */
export function writeLocalAuditLog(params: {
  userId?: string | null;
  email?: string | null;
  action: string;
  details?: string;
  ip?: string | null;
  userAgent?: string | null;
}): void {
  void prisma.auditLog
    .create({
      data: {
        userId: params.userId || undefined,
        email: params.email || undefined,
        action: params.action,
        details: params.details || undefined,
        ip: params.ip || undefined,
        userAgent: params.userAgent || undefined,
      },
    })
    .catch(() => {});
}

/** Inkai + Prisma lokal sekaligus (billing iuran). */
export function writeBillingAudit(params: AuditParams & BillingAuditMeta): void {
  const details =
    params.details ||
    formatBillingAuditDetails({
      memberId: params.memberId,
      billingId: params.billingId,
      billingAction: params.billingAction,
      notes: params.notes,
      amount: params.amount,
    });
  writeAuditLog({ ...params, details });
  writeLocalAuditLog({
    userId: params.userId,
    email: params.email,
    action: params.action,
    details,
    ip: params.ip,
    userAgent: params.userAgent,
  });
}
