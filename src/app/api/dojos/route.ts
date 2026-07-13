import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const dojos = await prisma.dojo.findMany({
    where: { isDeleted: false },
    select: {
      id: true,
      name: true,
      branch: { select: { name: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(
    dojos.map((d) => ({
      id: d.id,
      nama: d.name,
      cabang: { nama: d.branch.name },
    }))
  );
}
