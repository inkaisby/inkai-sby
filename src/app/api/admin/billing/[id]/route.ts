import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { inkaiFetch, inkaiErrorMessage } from "@/lib/inkai-api/server";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

const schema = z.object({
  action: z.enum(["approve", "reject"]),
  adminNotes: z.string().optional(),
});

export async function PATCH(request: Request, context: RouteContext) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!authResult.token) {
    return NextResponse.json({ error: "Token tidak tersedia" }, { status: 401 });
  }

  const { id } = await context.params;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const { res, data } = await inkaiFetch(
    "/v1/billing/verify",
    {
      method: "POST",
      body: JSON.stringify({
        billingId: id,
        status: parsed.data.action === "approve" ? "APPROVED" : "REJECTED",
        adminNotes: parsed.data.adminNotes,
      }),
    },
    authResult.token,
  );

  if (!res.ok) {
    return NextResponse.json(
      { error: inkaiErrorMessage(data, "Gagal memverifikasi iuran") },
      { status: res.status },
    );
  }

  return NextResponse.json({
    success: true,
    status: parsed.data.action === "approve" ? "PAID" : "REJECTED",
    message:
      parsed.data.action === "approve"
        ? "Iuran berhasil diverifikasi"
        : "Iuran berhasil ditolak",
  });
}
