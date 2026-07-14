import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { inkaiFetch, inkaiErrorMessage } from "@/lib/inkai-api/server";
import { getPrimaryAdminRole } from "@/lib/rbac";
import { canEditKyuBaru } from "@/lib/belt";
import { uktRegistrationUpdateSchema } from "@/lib/security/schemas";
import { writeAuditLog } from "@/lib/audit";
import { getClientIp } from "@/lib/security/request";

type RouteContext = { params: Promise<{ id: string }> };

function mapActionToStatus(data: {
  action?: string;
  status?: string;
}): string | undefined {
  if (data.action === "approve" || data.status === "APPROVED") return "APPROVED";
  if (data.action === "reject" || data.status === "REJECTED") return "REJECTED";
  if (data.action === "mark_paid" || data.status === "PAID") return "APPROVED";
  if (data.status) return data.status;
  return undefined;
}

export async function PATCH(request: Request, context: RouteContext) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!authResult.token) {
    return NextResponse.json({ error: "Token tidak tersedia" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json();
  const parsed = uktRegistrationUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const data = parsed.data;
  const role = getPrimaryAdminRole(authResult.user.roles);
  const isCabang = canEditKyuBaru(authResult.user.roles);

  if (data.newRank && !isCabang) {
    return NextResponse.json({ error: "Kyu Baru hanya dapat diubah oleh admin cabang" }, { status: 403 });
  }

  if (data.action === "approve" || data.action === "reject" || data.status) {
    const canApprove = ["ADMINISTRATOR", "ADMIN_PUSAT", "ADMIN_PROVINCE", "ADMIN_BRANCH", "ADMIN"].includes(role);
    if (!canApprove && data.action !== "reject") {
      return NextResponse.json({ error: "Hanya admin cabang yang dapat menyetujui pendaftaran" }, { status: 403 });
    }
  }

  const patchBody: Record<string, unknown> = {};
  const status = mapActionToStatus(data);
  if (status) patchBody.status = status;

  if (data.newRank) {
    patchBody.registeredRank = data.newRank;
  }

  if (data.categoryId) {
    patchBody.categoryId = data.categoryId;
  }

  const { res, data: apiData } = await inkaiFetch(
    `/v1/events/register/${id}`,
    {
      method: "PUT",
      body: JSON.stringify(patchBody),
    },
    authResult.token,
  );

  if (!res.ok) {
    return NextResponse.json(
      { error: inkaiErrorMessage(apiData, "Gagal memperbarui pendaftaran") },
      { status: res.status },
    );
  }

  if (data.action === "mark_paid") {
    const registration = apiData.data as Record<string, unknown>;
    const member = registration.member as { billings?: Array<{ id: string; status: string }> } | undefined;
    const billing = member?.billings?.find((b) => b.status === "PENDING");
    if (billing) {
      await inkaiFetch(
        "/v1/billing/verify",
        {
          method: "POST",
          body: JSON.stringify({ billingId: billing.id, status: "PAID" }),
        },
        authResult.token,
      );
    }
  }

  writeAuditLog({
    userId: authResult.user.id,
    email: authResult.user.email,
    action: "UKT_REGISTRATION_UPDATE",
    details: `Updated registration ${id}: ${JSON.stringify(data)}`,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    token: authResult.token,
  });

  return NextResponse.json({ success: true, registration: apiData.data });
}

export async function DELETE(request: Request, context: RouteContext) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!authResult.token) {
    return NextResponse.json({ error: "Token tidak tersedia" }, { status: 401 });
  }

  const { id } = await context.params;

  const { res, data } = await inkaiFetch(
    `/v1/events/register/${id}`,
    { method: "DELETE" },
    authResult.token,
  );

  if (!res.ok) {
    return NextResponse.json(
      { error: inkaiErrorMessage(data, "Gagal membatalkan pendaftaran") },
      { status: res.status },
    );
  }

  writeAuditLog({
    userId: authResult.user.id,
    email: authResult.user.email,
    action: "UKT_REGISTRATION_CANCEL",
    details: `Cancelled UKT registration (${id})`,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    token: authResult.token,
  });

  return NextResponse.json({ success: true, message: "Pendaftaran dibatalkan" });
}
