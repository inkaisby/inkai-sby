import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma, withPrismaFallback } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user.memberId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await withPrismaFallback(
    "member-materials",
    () =>
      prisma.digitalMaterial.findMany({
        where: { isPublished: true },
        orderBy: { createdAt: "desc" },
      }),
    [],
  );

  return NextResponse.json({ data: result.data });
}
