import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const dojos = await prisma.dojo.findMany({
    select: {
      id: true,
      nama: true,
      cabang: { select: { nama: true } },
    },
    orderBy: { nama: "asc" },
  });
  return NextResponse.json(dojos);
}
