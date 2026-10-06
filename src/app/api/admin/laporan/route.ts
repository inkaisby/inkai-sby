import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import {
  fetchReportDataForDomain,
  getAvailableReportDomains,
} from "@/lib/laporan-registry";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  // Endpoint action for dynamic domain auto-discovery
  if (action === "domains") {
    return NextResponse.json({
      success: true,
      availableDomains: getAvailableReportDomains(),
    });
  }

  const domain = searchParams.get("domain") || "anggota";
  const dojoId = searchParams.get("dojoId") || "";
  const startDate = searchParams.get("startDate") || "";
  const endDate = searchParams.get("endDate") || "";
  const q = searchParams.get("q") || "";

  try {
    const { meta, data } = await fetchReportDataForDomain(
      domain,
      { dojoId, startDate, endDate, q },
      authResult.user,
    );

    return NextResponse.json({
      success: true,
      domain: meta.id,
      domainMeta: meta,
      totalCount: data.length,
      columnsMeta: meta.columnsMeta,
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
