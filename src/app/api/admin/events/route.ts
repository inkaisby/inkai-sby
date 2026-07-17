import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { inkaiFetch, inkaiErrorMessage } from "@/lib/inkai-api/server";
import { canCreateEventsByWilayah } from "@/lib/wilayah-rbac";
import { SITE_BRANCH_NAME, SITE_PROVINCE_NAME } from "@/lib/site";
import { writeAuditLog } from "@/lib/audit";
import { getClientIp } from "@/lib/security/request";
import { z } from "zod";

const eventSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(4000).optional().or(z.literal("")),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  location: z.string().trim().max(200).optional().or(z.literal("")),
  registrationCloseAt: z.string().optional().or(z.literal("")),
  categoryName: z.string().trim().min(2).max(100).default("Umum"),
  fee: z.coerce.number().min(0).default(0),
});

async function resolveSurabayaBranchId(token: string) {
  const { res, data } = await inkaiFetch("/v1/org/provinces", {}, token);
  if (!res.ok) return null;
  const provinces = (data.data as Array<Record<string, unknown>>) ?? [];
  const province = provinces.find(
    (p) => String(p.name).toUpperCase() === SITE_PROVINCE_NAME.toUpperCase(),
  );
  const branches = (province?.branches as Array<Record<string, unknown>>) ?? [];
  const branch = branches.find(
    (b) => String(b.name).toUpperCase() === SITE_BRANCH_NAME.toUpperCase(),
  );
  return (branch?.id as string) ?? null;
}

export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!authResult.token) {
    return NextResponse.json({ error: "Token tidak tersedia" }, { status: 401 });
  }

  if (!canCreateEventsByWilayah(authResult.user.roles)) {
    return NextResponse.json(
      { error: "Hanya admin cabang yang dapat membuat event" },
      { status: 403 },
    );
  }

  const parsed = eventSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const start = new Date(parsed.data.startDate);
  const end = new Date(parsed.data.endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return NextResponse.json({ error: "Tanggal event tidak valid" }, { status: 400 });
  }

  const branchId = await resolveSurabayaBranchId(authResult.token);
  if (!branchId) {
    return NextResponse.json({ error: "Cabang tidak ditemukan" }, { status: 404 });
  }

  const regClose = parsed.data.registrationCloseAt
    ? new Date(parsed.data.registrationCloseAt)
    : start;

  const { res, data } = await inkaiFetch(
    "/v1/events",
    {
      method: "POST",
      body: JSON.stringify({
        title: parsed.data.title,
        description: parsed.data.description || parsed.data.title,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        location: parsed.data.location || "",
        registrationCloseAt: Number.isNaN(regClose.getTime())
          ? start.toISOString()
          : regClose.toISOString(),
        branchId,
        categories: [
          {
            name: parsed.data.categoryName,
            fee: parsed.data.fee,
          },
        ],
      }),
    },
    authResult.token,
  );

  if (!res.ok) {
    return NextResponse.json(
      { error: inkaiErrorMessage(data, "Gagal membuat event") },
      { status: res.status },
    );
  }

  writeAuditLog({
    userId: authResult.user.id,
    email: authResult.user.email,
    action: "EVENT_CREATE",
    details: `Created event: ${parsed.data.title}`,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    token: authResult.token,
  });

  return NextResponse.json({
    event: data.data,
    message: "Event berhasil dibuat",
  });
}
