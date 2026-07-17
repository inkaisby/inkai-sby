import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { inkaiFetch, inkaiErrorMessage } from "@/lib/inkai-api/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

const schema = z.object({
  action: z.enum(["approve", "reject"]),
  adminNotes: z.string().optional(),
});

async function applyDojoTransfer(claim: {
  type: string;
  memberId: string;
  data: string;
}) {
  if (claim.type !== "DOJO_TRANSFER" && claim.type !== "TRANSFER") return;
  try {
    const parsed = JSON.parse(claim.data) as { targetDojoId?: string };
    if (!parsed.targetDojoId) return;
    await prisma.member.update({
      where: { id: claim.memberId },
      data: { dojoId: parsed.targetDojoId },
    });
  } catch {
    // ignore malformed data
  }
}

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

  const status = parsed.data.action === "approve" ? "APPROVED" : "REJECTED";
  const local = await prisma.verification.findUnique({ where: { id } });

  const { res, data } = await inkaiFetch(
    `/v1/verifications/${id}/process`,
    {
      method: "POST",
      body: JSON.stringify({
        status,
        adminNotes: parsed.data.adminNotes,
      }),
    },
    authResult.token,
  );

  if (!res.ok) {
    // Fallback: proses klaim lokal (pindah dojo / piagam) bila API gagal
    if (local && local.status === "PENDING") {
      if (parsed.data.action === "approve") {
        await applyDojoTransfer(local);
      }
      await prisma.verification.update({
        where: { id },
        data: {
          status,
          adminNotes: parsed.data.adminNotes ?? local.adminNotes,
        },
      });
      return NextResponse.json({
        success: true,
        status,
        message:
          parsed.data.action === "approve"
            ? "Verifikasi berhasil disetujui"
            : "Verifikasi berhasil ditolak",
      });
    }

    return NextResponse.json(
      { error: inkaiErrorMessage(data, "Gagal memproses verifikasi") },
      { status: res.status },
    );
  }

  if (local && parsed.data.action === "approve") {
    await applyDojoTransfer(local);
    await prisma.verification
      .update({
        where: { id },
        data: {
          status: "APPROVED",
          adminNotes: parsed.data.adminNotes ?? local.adminNotes,
        },
      })
      .catch(() => null);
  } else if (local && parsed.data.action === "reject") {
    await prisma.verification
      .update({
        where: { id },
        data: {
          status: "REJECTED",
          adminNotes: parsed.data.adminNotes ?? local.adminNotes,
        },
      })
      .catch(() => null);
  }

  return NextResponse.json({
    success: true,
    status,
    message:
      parsed.data.action === "approve"
        ? "Verifikasi berhasil disetujui"
        : "Verifikasi berhasil ditolak",
  });
}
