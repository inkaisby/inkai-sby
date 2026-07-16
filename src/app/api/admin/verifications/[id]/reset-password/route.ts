import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { inkaiFetch, inkaiErrorMessage } from "@/lib/inkai-api/server";
import { prisma } from "@/lib/prisma";
import { validatePassword } from "@/lib/security/password";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

const schema = z.object({
  newPassword: z.string().min(8),
  adminNotes: z.string().optional(),
});

export async function POST(request: Request, context: RouteContext) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!authResult.token) {
    return NextResponse.json({ error: "Token tidak tersedia" }, { status: 401 });
  }

  const { id } = await context.params;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Password minimal 8 karakter" }, { status: 400 });
  }

  const pwCheck = validatePassword(parsed.data.newPassword);
  if (!pwCheck.valid) {
    return NextResponse.json(
      { error: pwCheck.error || "Password tidak valid" },
      { status: 400 },
    );
  }

  const claim = await prisma.verification.findUnique({
    where: { id },
    include: {
      member: {
        select: {
          id: true,
          fullName: true,
          dojoId: true,
          user: { select: { email: true } },
        },
      },
    },
  });

  if (!claim || claim.type !== "PASSWORD_RESET") {
    return NextResponse.json(
      { error: "Pengajuan reset password tidak ditemukan" },
      { status: 404 },
    );
  }

  if (claim.status !== "PENDING") {
    return NextResponse.json(
      { error: "Pengajuan sudah diproses" },
      { status: 400 },
    );
  }

  const { res: updateRes, data: updateData } = await inkaiFetch(
    `/v1/members/${claim.memberId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ password: parsed.data.newPassword }),
    },
    authResult.token,
  );

  if (!updateRes.ok) {
    return NextResponse.json(
      {
        error: inkaiErrorMessage(
          updateData,
          "Gagal mengubah password anggota",
        ),
      },
      { status: updateRes.status },
    );
  }

  const { res: processRes, data: processData } = await inkaiFetch(
    `/v1/verifications/${id}/process`,
    {
      method: "POST",
      body: JSON.stringify({
        status: "APPROVED",
        adminNotes:
          parsed.data.adminNotes?.trim() ||
          "Password diubah oleh admin ranting",
      }),
    },
    authResult.token,
  );

  if (!processRes.ok) {
    // Password already changed — still report partial success
    return NextResponse.json({
      success: true,
      warning: inkaiErrorMessage(
        processData,
        "Password diubah tetapi status pengajuan gagal diperbarui",
      ),
      message: `Password ${claim.member.fullName} berhasil diubah`,
    });
  }

  return NextResponse.json({
    success: true,
    message: `Password ${claim.member.fullName} berhasil diubah`,
    email: claim.member.user?.email ?? null,
  });
}
