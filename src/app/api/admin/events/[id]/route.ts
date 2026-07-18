import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { writeAuditLog } from "@/lib/audit";
import { inkaiFetch, inkaiErrorMessage } from "@/lib/inkai-api/server";
import { canCreateEventsByWilayah } from "@/lib/wilayah-rbac";
import { getClientIp } from "@/lib/security/request";
import { prisma, withPrismaFallback } from "@/lib/prisma";
import { z } from "zod";

const patchSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  description: z.string().trim().max(4000).optional().nullable(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  location: z.string().trim().max(200).optional().nullable(),
  registrationCloseAt: z.string().optional().nullable(),
  cancel: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!authResult.token) {
    return NextResponse.json({ error: "Token tidak tersedia" }, { status: 401 });
  }

  const { id } = await context.params;
  const { res, data } = await inkaiFetch(`/v1/events/${id}`, {}, authResult.token);
  if (!res.ok) {
    return NextResponse.json(
      { error: inkaiErrorMessage(data, "Event tidak ditemukan") },
      { status: res.status },
    );
  }

  const event = data.data as Record<string, unknown>;
  const registrations =
    (event.registrations as Array<Record<string, unknown>> | undefined) ??
    (event.eventRegistrations as Array<Record<string, unknown>> | undefined) ??
    [];

  return NextResponse.json({
    data: event,
    registrations,
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!authResult.token) {
    return NextResponse.json({ error: "Token tidak tersedia" }, { status: 401 });
  }
  if (!canCreateEventsByWilayah(authResult.user.roles)) {
    return NextResponse.json(
      { error: "Hanya admin cabang yang dapat mengubah event" },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const body: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.cancel) {
    // Tandai selesai dengan menutup registrasi & endDate ke sekarang
    body.endDate = new Date().toISOString();
    body.registrationCloseAt = new Date().toISOString();
    delete body.cancel;
  }

  const { res, data } = await inkaiFetch(
    `/v1/events/${id}`,
    { method: "PATCH", body: JSON.stringify(body) },
    authResult.token,
  );

  if (!res.ok) {
    // Coba PUT
    const put = await inkaiFetch(
      `/v1/events/${id}`,
      { method: "PUT", body: JSON.stringify(body) },
      authResult.token,
    );
    if (!put.res.ok) {
      // Fallback lokal
      const local = await withPrismaFallback(
        "event-update",
        () =>
          prisma.event.update({
            where: { id },
            data: {
              ...(parsed.data.title ? { title: parsed.data.title } : {}),
              ...(parsed.data.description !== undefined
                ? { description: parsed.data.description }
                : {}),
              ...(parsed.data.location !== undefined
                ? { location: parsed.data.location }
                : {}),
              ...(parsed.data.startDate
                ? { startDate: new Date(parsed.data.startDate) }
                : {}),
              ...(parsed.data.endDate || parsed.data.cancel
                ? {
                    endDate: new Date(
                      parsed.data.endDate || new Date().toISOString(),
                    ),
                  }
                : {}),
              ...(parsed.data.registrationCloseAt !== undefined
                ? {
                    registrationCloseAt: parsed.data.registrationCloseAt
                      ? new Date(parsed.data.registrationCloseAt)
                      : null,
                  }
                : {}),
            },
          }),
        null,
      );
      if (local.failed || !local.data) {
        return NextResponse.json(
          { error: inkaiErrorMessage(data, "Gagal memperbarui event") },
          { status: res.status },
        );
      }
    }
  }

  writeAuditLog({
    userId: authResult.user.id,
    email: authResult.user.email,
    action: parsed.data.cancel ? "EVENT_CANCEL" : "EVENT_UPDATE",
    details: JSON.stringify({ eventId: id, ...parsed.data }),
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    token: authResult.token,
  });

  return NextResponse.json({
    success: true,
    message: parsed.data.cancel ? "Event ditutup/dibatalkan" : "Event diperbarui",
  });
}
