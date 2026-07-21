import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { writeAuditLog } from "@/lib/audit";
import { canManageKebijakan } from "@/lib/pengaturan";
import { getClientIp } from "@/lib/security/request";
import { uktRegistrationPolicySchema } from "@/lib/security/schemas";
import {
  DEFAULT_UKT_REGISTRATION_POLICY,
  getUktRegistrationPolicy,
  setUktRegistrationPolicy,
} from "@/lib/ukt-registration-policy";

export async function GET() {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!canManageKebijakan(authResult.user)) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const policy = await getUktRegistrationPolicy();
  return NextResponse.json({ data: policy });
}

export async function PATCH(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!canManageKebijakan(authResult.user)) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const parsed = uktRegistrationPolicySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Data tidak valid" },
      { status: 400 },
    );
  }

  const policy = await setUktRegistrationPolicy({
    requireNoOutstandingDues: parsed.data.requireNoOutstandingDues,
    requireDocuments: parsed.data.requireDocuments,
    requireMinAttendance: parsed.data.requireMinAttendance,
    enforceForRanting: parsed.data.enforceForRanting,
    enforceForCabang: parsed.data.enforceForCabang,
    minAttendancePct:
      parsed.data.minAttendancePct ??
      DEFAULT_UKT_REGISTRATION_POLICY.minAttendancePct,
  });

  writeAuditLog({
    userId: authResult.user.id,
    email: authResult.user.email,
    action: "SETTINGS_UKT_POLICY_UPDATE",
    details: JSON.stringify(policy),
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    token: authResult.token,
  });

  return NextResponse.json({
    success: true,
    data: policy,
    message: "Pengaturan syarat UKT disimpan",
  });
}
