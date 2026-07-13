import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { surabayaDojoWhere } from "@/lib/security/branch-scope";
import { rateLimit, rateLimitResponse } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/request";

export async function GET(request: Request) {
  const ip = getClientIp(request);
  const limit = rateLimit(`dojos:${ip}`, {
    max: 60,
    windowMs: 60 * 1000,
  });

  if (!limit.success) {
    return rateLimitResponse(limit.retryAfterSec ?? 30);
  }

  const dojos = await prisma.dojo.findMany({
    where: surabayaDojoWhere,
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
      nama: d.name.trim(),
      cabang: { nama: d.branch.name },
    })),
    {
      headers: {
        "Cache-Control": "private, max-age=300",
      },
    }
  );
}
