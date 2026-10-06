import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import {
  fetchReportDataForDomain,
  getAvailableReportDomains,
} from "@/lib/laporan-registry";
import { getAdminScopeLabel, getPrimaryAdminRole } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  const user = authResult.user;
  const role = getPrimaryAdminRole(user.roles);

  const userScope = {
    role,
    scopeLabel: getAdminScopeLabel(user),
    isDojoScoped: role === "ADMIN_DOJO",
    managedDojoId: user.managedDojoId || null,
    managedBranchId: user.managedBranchId || null,
  };

  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  // Endpoint action for dynamic domain auto-discovery
  if (action === "domains") {
    return NextResponse.json({
      success: true,
      userScope,
      availableDomains: getAvailableReportDomains(),
    });
  }

  const domain = searchParams.get("domain") || "anggota";
  // If user is ADMIN_DOJO, force dojoId to user's managedDojoId
  const requestedDojoId = searchParams.get("dojoId") || "";
  const dojoId =
    role === "ADMIN_DOJO" && user.managedDojoId
      ? user.managedDojoId
      : requestedDojoId;
  const startDate = searchParams.get("startDate") || "";
  const endDate = searchParams.get("endDate") || "";
  const q = searchParams.get("q") || "";

  try {
    const { meta, data } = await fetchReportDataForDomain(
      domain,
      { dojoId, startDate, endDate, q },
      user,
    );

    return NextResponse.json({
      success: true,
      domain: meta.id,
      domainMeta: meta,
      totalCount: data.length,
      columnsMeta: meta.columnsMeta,
      userScope,
      availableDomains: getAvailableReportDomains(),
      data,
    });
  } catch (error) {
    console.error("[laporan-api]", error);
    return NextResponse.json(
      { error: "Gagal memuat data laporan" },
      { status: 500 },
    );
  }
}
