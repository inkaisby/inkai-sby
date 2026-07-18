import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { writeAuditLog } from "@/lib/audit";
import { canManageKebijakan } from "@/lib/pengaturan";
import {
  getBranchOrgProfile,
  getOperationalDefaults,
  setBranchOrgProfile,
  setOperationalDefaults,
} from "@/lib/org-settings";
import {
  branchOrgProfileSchema,
  operationalDefaultsSchema,
} from "@/lib/security/schemas";
import { getClientIp } from "@/lib/security/request";

export async function GET() {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!canManageKebijakan(authResult.user)) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const [profile, defaults] = await Promise.all([
    getBranchOrgProfile(),
    getOperationalDefaults(),
  ]);

  return NextResponse.json({ data: { profile, defaults } });
}

export async function PATCH(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!canManageKebijakan(authResult.user)) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const body = await request.json();
  const section = typeof body.section === "string" ? body.section : "";

  if (section === "profile") {
    const parsed = branchOrgProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Data tidak valid" },
        { status: 400 },
      );
    }
    const profile = await setBranchOrgProfile({
      ...parsed.data,
      ketuaCabangName: parsed.data.ketuaCabangName ?? "",
    });
    writeAuditLog({
      userId: authResult.user.id,
      email: authResult.user.email,
      action: "SETTINGS_ORG_PROFILE_UPDATE",
      details: JSON.stringify({ email: profile.email, bankName: profile.bankName }),
      ip: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      token: authResult.token,
    });
    return NextResponse.json({
      success: true,
      data: profile,
      message: "Profil organisasi disimpan",
    });
  }

  if (section === "defaults") {
    const parsed = operationalDefaultsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Data tidak valid" },
        { status: 400 },
      );
    }
    const defaults = await setOperationalDefaults({
      monthlyDuesAmount: parsed.data.monthlyDuesAmount,
      paymentInstructions: parsed.data.paymentInstructions,
      forcePasswordHint: parsed.data.forcePasswordHint ?? true,
    });
    writeAuditLog({
      userId: authResult.user.id,
      email: authResult.user.email,
      action: "SETTINGS_ORG_DEFAULTS_UPDATE",
      details: JSON.stringify({
        monthlyDuesAmount: defaults.monthlyDuesAmount,
      }),
      ip: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      token: authResult.token,
    });
    return NextResponse.json({
      success: true,
      data: defaults,
      message: "Kebijakan operasional disimpan",
    });
  }

  return NextResponse.json({ error: "Section tidak valid" }, { status: 400 });
}
