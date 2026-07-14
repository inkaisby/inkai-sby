import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notifications";
import { z } from "zod";

const profileSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  address: z.string().trim().max(500).optional(),
  phoneNumber: z.string().trim().max(15).optional(),
});

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user.memberId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.member.update({
      where: { id: session.user.memberId },
      data: {
        fullName: parsed.data.fullName,
        address: parsed.data.address || null,
      },
    }),
    prisma.user.update({
      where: { id: session.user.id },
      data: {
        fullName: parsed.data.fullName,
        phoneNumber: parsed.data.phoneNumber || null,
      },
    }),
  ]);

  await notifyUser({
    userId: session.user.id,
    title: "Profil Diperbarui",
    content: "Data profil Anda berhasil disimpan.",
    type: "SUCCESS",
  });

  return NextResponse.json({
    success: true,
    message: "Profil berhasil diperbarui",
  });
}
