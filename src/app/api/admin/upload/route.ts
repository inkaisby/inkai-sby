import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { writeAuditLog } from "@/lib/audit";
import { canEditPengurus, getPrimaryAdminRole } from "@/lib/rbac";
import { getClientIp } from "@/lib/security/request";
import { isBlobUploadConfigured, uploadAdminFile } from "@/lib/upload";

export async function GET() {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  return NextResponse.json({
    configured: isBlobUploadConfigured(),
  });
}

export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  const role = getPrimaryAdminRole(authResult.user.roles);
  const canUpload =
    canEditPengurus(authResult.user.roles) ||
    role === "ADMIN_DOJO" ||
    role === "ADMIN_BRANCH";

  if (!canUpload) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const form = await request.formData();
  const file = form.get("file");
  const folder = String(form.get("folder") || "uploads");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File wajib diunggah" }, { status: 400 });
  }

  try {
    const result = await uploadAdminFile(file, folder);
    writeAuditLog({
      token: authResult.token,
      action: "ADMIN_UPLOAD",
      details: `folder=${folder}; pathname=${result.pathname}; type=${file.type}; size=${file.size}`,
      ip: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
    });
    return NextResponse.json({
      success: true,
      url: result.url,
      pathname: result.pathname,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal mengunggah file";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
