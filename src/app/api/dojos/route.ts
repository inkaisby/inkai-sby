import { NextResponse } from "next/server";
import { inkaiFetch } from "@/lib/inkai-api/server";
import { SITE_BRANCH_NAME, SITE_PROVINCE_NAME } from "@/lib/site";
import { rateLimit, rateLimitResponse } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/request";

export async function GET(request: Request) {
  const ip = getClientIp(request);
  const limit = rateLimit(`dojos:${ip}`, { max: 60, windowMs: 60_000 });
  if (!limit.success) return rateLimitResponse(limit.retryAfterSec ?? 60);

  const provinces = await inkaiFetch("/v1/org/provinces", {}, null);
  if (!provinces.res.ok) {
    return NextResponse.json({ error: "Gagal memuat provinsi" }, { status: 500 });
  }

  const provinceList = (provinces.data.data as Array<{ id: string; name: string }>) ?? [];
  const jatim = provinceList.find(
    (p) => p.name.toUpperCase() === SITE_PROVINCE_NAME,
  );
  if (!jatim) {
    return NextResponse.json({ data: [] });
  }

  const branches = await inkaiFetch(`/v1/org/branches/${jatim.id}`, {}, null);
  if (!branches.res.ok) {
    return NextResponse.json({ error: "Gagal memuat cabang" }, { status: 500 });
  }

  const branchList = (branches.data.data as Array<{ id: string; name: string }>) ?? [];
  const sby = branchList.find((b) => b.name.toUpperCase() === SITE_BRANCH_NAME);
  if (!sby) {
    return NextResponse.json({ data: [] });
  }

  const dojos = await inkaiFetch(`/v1/org/dojos/${sby.id}`, {}, null);
  if (!dojos.res.ok) {
    return NextResponse.json({ error: "Gagal memuat dojo" }, { status: 500 });
  }

  const dojoList =
    (dojos.data.data as Array<{ id: string; name: string; branch?: { name?: string } }>) ?? [];

  const data = dojoList.map((d) => ({
    id: d.id,
    nama: d.name,
    cabang: { nama: d.branch?.name ?? SITE_BRANCH_NAME },
  }));

  return NextResponse.json(
    { data },
    { headers: { "Cache-Control": "private, max-age=300" } },
  );
}
