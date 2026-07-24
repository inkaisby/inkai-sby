import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { writeAuditLog } from "@/lib/audit";
import { canEditPengurus, getPrimaryAdminRole } from "@/lib/rbac";
import { getClientIp } from "@/lib/security/request";
import {
  rateLimitAsync,
  rateLimitResponse,
} from "@/lib/security/rate-limit";
import {
  isBlobUploadConfigured,
  uploadAdminFile,
  UploadValidationError,
} from "@/lib/upload";

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

  const rlKey = `admin-upload:${authResult.user.id}`;
  const limit = await rateLimitAsync(rlKey, { max: 30, windowMs: 60_000 });
  if (!limit.success) {
    return rateLimitResponse(limit.retryAfterSec ?? 60, rlKey);
  }

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
    if (error instanceof UploadValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[admin upload] failed:", error);
    return NextResponse.json(
      { error: "Gagal mengunggah file" },
      { status: 500 },
    );
  }
}
