import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { writeAuditLog } from "@/lib/audit";
import { fetchAdminMembers, fetchAdminMembersForDojoIds, fetchBillings } from "@/lib/inkai-api/admin-data";
import { inkaiFetch, inkaiErrorMessage } from "@/lib/inkai-api/server";
import { getOperationalDefaults } from "@/lib/org-settings";
import { prisma } from "@/lib/prisma";
import { getPrimaryAdminRole } from "@/lib/rbac";
import { getClientIp } from "@/lib/security/request";
import { canManageIuranByWilayah } from "@/lib/wilayah-rbac";
import { z } from "zod";

const schema = z.object({
  year: z.coerce.number().int().min(2020).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  amount: z.coerce.number().min(0).max(10_000_000).optional(),
  dryRun: z.boolean().optional(),
});

function periodKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function dueDateFor(year: number, month: number) {
  // Jatuh tempo akhir bulan
  return new Date(year, month, 0, 23, 59, 59);
}

export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!authResult.token) {
    return NextResponse.json({ error: "Token tidak tersedia" }, { status: 401 });
  }
  if (!canManageIuranByWilayah(authResult.user.roles)) {
    return NextResponse.json(
      { error: "Anda tidak berwenang membuat tagihan iuran" },
      { status: 403 },
    );
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const { year, month, dryRun } = parsed.data;
  const defaults = await getOperationalDefaults();
  const amount = parsed.data.amount ?? defaults.monthlyDuesAmount;
  const key = periodKey(year, month);
  const description = `Iuran bulanan ${key}`;
  const dueDate = dueDateFor(year, month);

  const role = getPrimaryAdminRole(authResult.user.roles);
  const allowlist =
    role === "ADMIN_DOJO"
      ? authResult.user.managedDojoIds && authResult.user.managedDojoIds.length > 0
        ? authResult.user.managedDojoIds
        : authResult.user.managedDojoId
          ? [authResult.user.managedDojoId]
          : []
      : [];

  const membersResult =
    allowlist.length > 1
      ? await fetchAdminMembersForDojoIds(authResult.token, allowlist, {
          status: "ACTIVE",
          limit: 500,
        })
      : await fetchAdminMembers(authResult.token, {
          status: "ACTIVE",
          limit: 500,
          dojoId: allowlist[0],
        });
  const members =
    membersResult.ok && "members" in membersResult
      ? membersResult.members
      : [];

  const existing = await fetchBillings(authResult.token, { limit: 500 });
  const existingKeys = new Set(
    existing
      .filter((b) => {
        const desc = String(b.description ?? "");
        const type = String(b.type ?? "");
        return (
          (type === "MONTHLY" || type === "IURAN" || type === "DUES") &&
          (desc.includes(key) || desc.includes(`Iuran bulanan ${key}`))
        );
      })
      .map((b) => String((b as { memberId?: string }).memberId ?? (b.member as { id?: string } | undefined)?.id ?? "")),
  );

  const targets = members.filter((m) => {
    if (m.status && m.status !== "ACTIVE") return false;
    return !existingKeys.has(m.id);
  });

  if (dryRun) {
    return NextResponse.json({
      success: true,
      dryRun: true,
      amount,
      period: key,
      wouldCreate: targets.length,
      skipped: members.length - targets.length,
      message: `Dry-run: ${targets.length} tagihan baru untuk ${key}`,
    });
  }

  let created = 0;
  let failed = 0;
  const errors: string[] = [];
  const CHUNK = 15;
  const queue = targets.slice(0, 200);

  for (let i = 0; i < queue.length; i += CHUNK) {
    const chunk = queue.slice(i, i + CHUNK);
    const settled = await Promise.allSettled(
      chunk.map(async (m) => {
        const memberAmount =
          typeof m.monthlyDuesAmount === "number" &&
          Number.isFinite(m.monthlyDuesAmount)
            ? m.monthlyDuesAmount
            : amount;
        const body = {
          memberId: m.id,
          type: "MONTHLY",
          amount: memberAmount,
          dueDate: dueDate.toISOString(),
          description,
        };

        const { res, data } = await inkaiFetch(
          "/v1/billing",
          { method: "POST", body: JSON.stringify(body) },
          authResult.token,
        );

        if (res.ok) return { ok: true as const, name: m.fullName };

        try {
          await prisma.billing.create({
            data: {
              memberId: m.id,
              type: "MONTHLY",
              amount: memberAmount,
              description,
              dueDate,
              status: "PENDING",
            },
          });
          return { ok: true as const, name: m.fullName };
        } catch (e) {
          return {
            ok: false as const,
            name: m.fullName,
            error: inkaiErrorMessage(
              data,
              e instanceof Error ? e.message : "gagal",
            ),
          };
        }
      }),
    );

    for (const r of settled) {
      if (r.status === "fulfilled" && r.value.ok) {
        created += 1;
      } else {
        failed += 1;
        if (errors.length < 5) {
          const msg =
            r.status === "fulfilled"
              ? `${r.value.name}: ${"error" in r.value ? r.value.error : "gagal"}`
              : String(r.reason);
          errors.push(msg);
        }
      }
    }
  }

  writeAuditLog({
    userId: authResult.user.id,
    email: authResult.user.email,
    action: "BILLING_GENERATE_MONTHLY",
    details: JSON.stringify({
      period: key,
      amount,
      created,
      failed,
      candidate: targets.length,
    }),
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    token: authResult.token,
  });

  return NextResponse.json({
    success: failed === 0,
    period: key,
    amount,
    created,
    failed,
    skipped: members.length - targets.length,
    errors,
    message:
      failed === 0
        ? `Berhasil membuat ${created} tagihan iuran ${key}`
        : `Dibuat ${created}, gagal ${failed}`,
  });
}
