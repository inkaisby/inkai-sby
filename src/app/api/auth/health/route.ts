import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const userCount = await prisma.user.count({ where: { isDeleted: false } });

    return NextResponse.json({
      ok: true,
      database: "connected",
      provider: "supabase-postgresql",
      auth: "nextauth-credentials",
      users: userCount,
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        database: "disconnected",
        message: "Tidak dapat terhubung ke Supabase PostgreSQL. Periksa DATABASE_URL.",
      },
      { status: 503 }
    );
  }
}
