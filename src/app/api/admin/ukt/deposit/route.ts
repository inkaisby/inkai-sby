import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { writeAuditLog } from "@/lib/audit";
import { canEditKyuBaru } from "@/lib/belt";
import { getPrimaryAdminRole } from "@/lib/rbac";
import { inkaiErrorMessage, inkaiFetch } from "@/lib/inkai-api/server";
import { uktDepositKey } from "@/lib/ukt";
import { uktDepositSchema } from "@/lib/security/schemas";
import { getClientIp } from "@/lib/security/request";

export async function PATCH(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!authResult.token) {
    return NextResponse.json({ error: "Token tidak tersedia" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = uktDepositSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const { eventId, dojoId, status, note } = parsed.data;
  const isCabang = canEditKyuBaru(authResult.user.roles);
  const isDojo = getPrimaryAdminRole(authResult.user.roles) === "ADMIN_DOJO";

  if (!isCabang && !isDojo) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  if (isDojo) {
    const allowlist =
      authResult.user.managedDojoIds && authResult.user.managedDojoIds.length > 0
        ? authResult.user.managedDojoIds
        : authResult.user.managedDojoId
          ? [authResult.user.managedDojoId]
          : [];
    if (!allowlist.includes(dojoId)) {
      return NextResponse.json(
        { error: "Hanya ranting yang Anda kelola yang boleh diubah" },
        { status: 403 },
      );
    }
    if (status === "RECEIVED") {
      return NextResponse.json(
        { error: "Hanya cabang yang dapat menandai setoran diterima" },
        { status: 403 },
      );
    }
  }

  const key = uktDepositKey(eventId, dojoId);
  const value = {
    status,
    note: note?.trim() || "",
    at: new Date().toISOString(),
    by: authResult.user.email,
  };

  const { res, data } = await inkaiFetch(
    `/v1/settings/${encodeURIComponent(key)}`,
    { method: "PUT", body: JSON.stringify({ value }) },
    authResult.token,
  );

  if (!res.ok) {
    return NextResponse.json(
      { error: inkaiErrorMessage(data, "Gagal menyimpan status setoran") },
      { status: res.status },
    );
  }

  writeAuditLog({
    userId: authResult.user.id,
    email: authResult.user.email,
    action: "UKT_DEPOSIT_STATUS",
    details: JSON.stringify({ eventId, dojoId, status }),
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    token: authResult.token,
  });

  return NextResponse.json({
    success: true,
    data: value,
    message: "Status setoran diperbarui",
  });
}
