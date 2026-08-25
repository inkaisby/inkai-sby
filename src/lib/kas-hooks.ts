import { getPrimaryAdminRole, type SessionUser } from "@/lib/rbac";
import { isLatberEventTitle } from "@/lib/latber";
import { ymdWib } from "@/lib/kas";
import { formatLatberKasKegiatan, formatUktKasKegiatan } from "@/lib/kas-kegiatan";
import {
  postKasEntry,
  resolveDojoBranchScope,
  voidKasBySource,
} from "@/lib/kas-store";

function roundRp(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
}

export async function postKasFromIuranPaid(opts: {
  user: SessionUser;
  billingId: string;
  amount: number;
  description?: string | null;
  dueDate?: Date | null;
  memberDojoId: string | null;
  memberId?: string | null;
  memberName?: string | null;
  action: "approve" | "mark_paid" | "reject";
}) {
  if (opts.action === "reject") {
    await voidKasBySource({
      sourceType: "iuran",
      sourceId: `${opts.billingId}:branch`,
      actorUserId: opts.user.id,
    });
    await voidKasBySource({
      sourceType: "iuran",
      sourceId: `${opts.billingId}:dojo`,
      actorUserId: opts.user.id,
    });
    return;
  }

  const amount = roundRp(opts.amount);
  if (amount <= 0) return;
  const ymd = opts.dueDate ? ymdWib(opts.dueDate) : ymdWib();
  const kegiatan = `Iuran ${ymd.slice(0, 7)}`;
  const name = opts.memberName?.trim() || "Anggota";
  const desc = opts.description?.trim() || `Setor iuran ${name}`;
  const role = getPrimaryAdminRole(opts.user.roles ?? []);
  const scopes = opts.memberDojoId
    ? await resolveDojoBranchScope(opts.memberDojoId)
    : { dojo: null, branch: null };

  if (opts.action === "mark_paid" && role === "ADMIN_DOJO" && scopes.dojo) {
    await postKasEntry({
      scope: scopes.dojo,
      txnDate: ymd,
      description: desc,
      kegiatan,
      direction: "in",
      amount,
      sourceType: "iuran",
      sourceId: `${opts.billingId}:dojo`,
      sourceHref: `/admin/iuran?memberId=${encodeURIComponent(opts.memberId ?? "")}`,
      createdById: opts.user.id,
    });
    return;
  }

  if (scopes.dojo && scopes.branch) {
    await postKasEntry({
      scope: scopes.dojo,
      txnDate: ymd,
      description: `Setor ke cabang — ${desc}`,
      kegiatan,
      direction: "out",
      amount,
      sourceType: "iuran",
      sourceId: `${opts.billingId}:dojo`,
      sourceHref: `/admin/iuran`,
      createdById: opts.user.id,
    });
    await postKasEntry({
      scope: scopes.branch,
      txnDate: ymd,
      description: desc,
      kegiatan,
      direction: "in",
      amount,
      sourceType: "iuran",
      sourceId: `${opts.billingId}:branch`,
      sourceHref: `/admin/iuran`,
      createdById: opts.user.id,
    });
    return;
  }

  if (scopes.branch) {
    await postKasEntry({
      scope: scopes.branch,
      txnDate: ymd,
      description: desc,
      kegiatan,
      direction: "in",
      amount,
      sourceType: "iuran",
      sourceId: `${opts.billingId}:branch`,
      sourceHref: `/admin/iuran`,
      createdById: opts.user.id,
    });
  }
}

function roundThousands(n: number): number {
  const rounded = roundRp(n);
  return rounded - (rounded % 1000);
}

export async function postKasFromUktPaid(opts: {
  user: SessionUser;
  billingId: string;
  amount: number;
  memberName: string;
  memberNia?: string | null;
  periodTitle: string;
  memberDojoId?: string | null;
}) {
  const amount = roundThousands(opts.amount);
  if (amount <= 0) return;
  const scopes = opts.memberDojoId
    ? await resolveDojoBranchScope(opts.memberDojoId)
    : { dojo: null, branch: null, dojoName: null };
  const branch = scopes.branch;
  if (!branch) return;
  const nia = opts.memberNia ? ` (${opts.memberNia})` : "";
  await postKasEntry({
    scope: branch,
    txnDate: ymdWib(),
    description: `${opts.memberName}${nia}`,
    kegiatan: formatUktKasKegiatan(opts.periodTitle, scopes.dojoName),
    direction: "in",
    amount,
    sourceType: "ukt",
    sourceId: opts.billingId,
    sourceHref: `/admin/ukt`,
    createdById: opts.user.id,
  });
}

export async function postKasFromLatberPaid(opts: {
  user: SessionUser;
  billingId: string;
  feeAmount: number;
  komisiRanting: number;
  memberName: string;
  memberNia?: string | null;
  periodTitle: string;
  memberDojoId: string | null;
}) {
  const fee = roundThousands(opts.feeAmount);
  const komisi = Math.min(fee, roundRp(opts.komisiRanting));
  const nett = Math.max(0, fee - komisi);
  const scopes = opts.memberDojoId
    ? await resolveDojoBranchScope(opts.memberDojoId)
    : { dojo: null, branch: null, dojoName: null };
  const nia = opts.memberNia ? ` (${opts.memberNia})` : "";
  const desc = `${opts.memberName}${nia}`;
  const kegiatan = formatLatberKasKegiatan(opts.periodTitle, scopes.dojoName);

  if (scopes.branch && nett > 0) {
    await postKasEntry({
      scope: scopes.branch,
      txnDate: ymdWib(),
      description: desc,
      kegiatan,
      direction: "in",
      amount: nett,
      sourceType: "latber",
      sourceId: `${opts.billingId}:cabang`,
      sourceHref: `/admin/latber`,
      createdById: opts.user.id,
    });
  }
  if (scopes.dojo && komisi > 0) {
    await postKasEntry({
      scope: scopes.dojo,
      txnDate: ymdWib(),
      description: `Komisi ranting — ${desc}`,
      kegiatan,
      direction: "in",
      amount: komisi,
      sourceType: "latber",
      sourceId: `${opts.billingId}:ranting`,
      sourceHref: `/admin/latber`,
      createdById: opts.user.id,
    });
  }
}

export async function voidKasFromBilling(billingId: string, userId?: string) {
  await voidKasBySource({ sourceType: "iuran", sourceId: `${billingId}:branch`, actorUserId: userId });
  await voidKasBySource({ sourceType: "iuran", sourceId: `${billingId}:dojo`, actorUserId: userId });
  await voidKasBySource({ sourceType: "ukt", sourceId: billingId, actorUserId: userId });
  await voidKasBySource({ sourceType: "latber", sourceId: `${billingId}:cabang`, actorUserId: userId });
  await voidKasBySource({ sourceType: "latber", sourceId: `${billingId}:ranting`, actorUserId: userId });
}

export function classifyBillingForKas(billing: {
  type?: string | null;
  description?: string | null;
  registrationId?: string | null;
}): "iuran" | "ukt" | "latber" | "skip" {
  const blob = `${billing.type ?? ""} ${billing.description ?? ""}`;
  if (isLatberEventTitle(blob) || /latihan bersama/i.test(blob)) return "latber";
  if (/\bUKT\b/i.test(blob)) return "ukt";
  if (billing.registrationId) return "skip";
  return "iuran";
}
