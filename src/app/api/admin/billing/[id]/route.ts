import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { inkaiFetch, inkaiErrorMessage } from "@/lib/inkai-api/server";
import { prisma } from "@/lib/prisma";
import { getPrimaryAdminRole, type SessionUser } from "@/lib/rbac";
import { canManageIuranByWilayah } from "@/lib/wilayah-rbac";
import { adminBillingPatchSchema } from "@/lib/security/schemas";
import { writeAuditLog } from "@/lib/audit";
import { getClientIp } from "@/lib/security/request";
import {
  deleteBillingHard,
  forceUnlinkBillingsInDb,
} from "@/lib/billing-delete";
import { canEditKyuBaru } from "@/lib/belt";

type RouteContext = { params: Promise<{ id: string }> };

async function assertBillingInScope(user: SessionUser, billingId: string) {
  const role = getPrimaryAdminRole(user.roles);
  const billing = await prisma.billing.findFirst({
    where: { id: billingId, isDeleted: false },
    include: {
      member: { select: { id: true, dojoId: true, fullName: true } },
    },
  });

  // Jika tidak ada di DB lokal, biarkan API Inkai yang memutuskan scope
  if (!billing) return { ok: true as const, billing: null };

  if (role === "ADMIN_DOJO") {
    const allowlist =
      user.managedDojoIds && user.managedDojoIds.length > 0
        ? user.managedDojoIds
        : user.managedDojoId
          ? [user.managedDojoId]
          : [];
    if (
      allowlist.length > 0 &&
      !allowlist.includes(billing.member.dojoId)
    ) {
      return { ok: false as const, error: "Tagihan di luar ranting Anda" };
    }
  }

  return { ok: true as const, billing };
}

async function verifyBilling(
  token: string,
  billingId: string,
  status: "APPROVED" | "REJECTED" | "PAID",
  adminNotes?: string,
) {
  const attempts = [
    { status },
    ...(status === "PAID" ? [{ status: "APPROVED" as const }] : []),
  ];

  let lastError = "Gagal memproses iuran";
  let lastStatus = 400;

  for (const body of attempts) {
    const { res, data } = await inkaiFetch(
      "/v1/billing/verify",
      {
        method: "POST",
        body: JSON.stringify({
          billingId,
          status: body.status,
          ...(adminNotes ? { adminNotes } : {}),
        }),
      },
      token,
    );
    if (res.ok) return { ok: true as const, data };
    lastError = inkaiErrorMessage(data, lastError);
    lastStatus = res.status;
    if (res.status !== 400 && res.status !== 422) break;
  }

  return { ok: false as const, error: lastError, status: lastStatus };
}

export async function PATCH(request: Request, context: RouteContext) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!authResult.token) {
    return NextResponse.json({ error: "Token tidak tersedia" }, { status: 401 });
  }

  if (!canManageIuranByWilayah(authResult.user.roles)) {
    return NextResponse.json(
      { error: "Anda tidak berhak mengelola/edit iuran" },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const parsed = adminBillingPatchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const scope = await assertBillingInScope(authResult.user, id);
  if (!scope.ok) {
    return NextResponse.json({ error: scope.error }, { status: 403 });
  }

  const data = parsed.data;

  if (data.action === "update") {
    if (scope.billing?.status === "PAID") {
      return NextResponse.json(
        { error: "Tagihan yang sudah lunas tidak dapat diedit" },
        { status: 400 },
      );
    }

    const patch: Record<string, unknown> = {};
    if (data.amount != null) patch.amount = data.amount;
    if (data.description !== undefined) patch.description = data.description;
    if (data.dueDate) {
      const due = new Date(data.dueDate);
      if (Number.isNaN(due.getTime())) {
        return NextResponse.json({ error: "Tanggal jatuh tempo tidak valid" }, { status: 400 });
      }
      patch.dueDate = due.toISOString();
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "Tidak ada perubahan" }, { status: 400 });
    }

    const { res, data: apiData } = await inkaiFetch(
      `/v1/billing/${id}`,
      { method: "PATCH", body: JSON.stringify(patch) },
      authResult.token,
    );

    let updated = apiData?.data as Record<string, unknown> | undefined;

    if (!res.ok) {
      // Fallback DB lokal (shared schema)
      try {
        const localPatch: {
          amount?: number;
          description?: string | null;
          dueDate?: Date;
        } = {};
        if (data.amount != null) localPatch.amount = data.amount;
        if (data.description !== undefined) localPatch.description = data.description;
        if (data.dueDate) localPatch.dueDate = new Date(data.dueDate);

        updated = (await prisma.billing.update({
          where: { id },
          data: localPatch,
        })) as unknown as Record<string, unknown>;
      } catch {
        return NextResponse.json(
          { error: inkaiErrorMessage(apiData, "Gagal mengedit tagihan") },
          { status: res.status },
        );
      }
    }

    writeAuditLog({
      userId: authResult.user.id,
      email: authResult.user.email,
      action: "BILLING_UPDATE",
      details: `Updated billing ${id}: ${JSON.stringify(patch)}`,
      ip: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      token: authResult.token,
    });

    return NextResponse.json({
      success: true,
      billing: updated,
      message: "Tagihan berhasil diperbarui",
    });
  }

  const verifyStatus =
    data.action === "reject"
      ? ("REJECTED" as const)
      : data.action === "mark_paid"
        ? ("PAID" as const)
        : ("APPROVED" as const);

  const result = await verifyBilling(
    authResult.token,
    id,
    verifyStatus,
    data.adminNotes,
  );

  if (!result.ok) {
    // Fallback lokal: tandai lunas / tolak di DB
    if (scope.billing) {
      try {
        const nextStatus =
          data.action === "reject" ? "REJECTED" : "PAID";
        await prisma.billing.update({
          where: { id },
          data: { status: nextStatus },
        });
        if (nextStatus === "PAID") {
          const existing = await prisma.payment.findUnique({
            where: { billingId: id },
          });
          if (existing) {
            await prisma.payment.update({
              where: { billingId: id },
              data: {
                paymentMethod: "CASH",
                paidAt: new Date(),
                proofUrl: existing.proofUrl || "—",
              },
            });
          } else {
            await prisma.payment.create({
              data: {
                billingId: id,
                paymentMethod: "CASH",
                paidAt: new Date(),
                proofUrl: "—",
              },
            });
          }
        }
      } catch {
        return NextResponse.json(
          { error: result.error },
          { status: result.status },
        );
      }
    } else {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }
  }

  writeAuditLog({
    userId: authResult.user.id,
    email: authResult.user.email,
    action: "BILLING_VERIFY",
    details: `${data.action} billing ${id}`,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    token: authResult.token,
  });

  const message =
    data.action === "reject"
      ? "Iuran berhasil ditolak"
      : data.action === "mark_paid"
        ? "Iuran ditandai lunas"
        : "Iuran berhasil diverifikasi";

  return NextResponse.json({
    success: true,
    status: data.action === "reject" ? "REJECTED" : "PAID",
    message,
  });
}

export async function DELETE(request: Request, context: RouteContext) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!authResult.token) {
    return NextResponse.json({ error: "Token tidak tersedia" }, { status: 401 });
  }

  if (!canManageIuranByWilayah(authResult.user.roles)) {
    return NextResponse.json(
      { error: "Anda tidak berhak menghapus tagihan" },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const url = new URL(request.url);
  const force =
    url.searchParams.get("force") === "1" ||
    url.searchParams.get("force") === "true";

  const scope = await assertBillingInScope(authResult.user, id);
  if (!scope.ok) {
    return NextResponse.json({ error: scope.error }, { status: 403 });
  }

  let status = scope.billing?.status ?? null;
  if (!status) {
    const { res, data } = await inkaiFetch(`/v1/billing/${id}`, {}, authResult.token);
    if (res.ok) {
      const billing = data.data as { status?: string } | undefined;
      status = billing?.status ? String(billing.status) : null;
    }
  }

  const isPaid =
    status === "PAID" || status === "SUCCESS" || status === "APPROVED";
  const isCabang = canEditKyuBaru(authResult.user.roles);

  if ((force || isPaid) && !isCabang) {
    return NextResponse.json(
      { error: "Hanya admin cabang yang dapat menghapus tagihan yang sudah lunas" },
      { status: 403 },
    );
  }

  const result = await deleteBillingHard(authResult.token, id, {
    continueOnFailure: false,
  });

  let usedDbForce = false;
  if (!result.ok) {
    if (!isCabang) {
      return NextResponse.json(
        { error: result.error || "Gagal menghapus tagihan" },
        { status: result.status || 400 },
      );
    }
    // Cabang: API gagal (sering karena lunas) → putuskan di shared DB
    const unlink = await forceUnlinkBillingsInDb([id]);
    if (!unlink.ok) {
      return NextResponse.json(
        { error: unlink.error || result.error || "Gagal menghapus tagihan" },
        { status: 500 },
      );
    }
    usedDbForce = true;
  } else {
    try {
      await prisma.billing.updateMany({
        where: { id },
        data: { isDeleted: true },
      });
    } catch {
      /* ignore */
    }
  }

  writeAuditLog({
    userId: authResult.user.id,
    email: authResult.user.email,
    action: "BILLING_DELETE",
    details: `Deleted billing ${id}${force || isPaid ? " [force]" : ""}${
      usedDbForce ? " [db-force]" : ""
    }`,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    token: authResult.token,
  });

  return NextResponse.json({
    success: true,
    message: "Tagihan berhasil dihapus",
  });
}
