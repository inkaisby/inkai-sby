import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireAdmin } from "@/lib/admin-auth";
import { rateLimitAsync, rateLimitResponse } from "@/lib/security/rate-limit";
import { kasPostSchema } from "@/lib/security/schemas";
import {
  KAS_MAX_BATCH,
  filterRange,
  groupKasTable,
  kasKpis,
  monthBounds,
  sumBefore,
  withRunningSaldo,
  yearMonthWib,
} from "@/lib/kas";
import {
  KasPeriodLockedError,
  KasScopeError,
  canAccessKas,
  canWriteKas,
  listKasEntries,
  listKasLocks,
  postKasBatch,
  resolveKasScope,
} from "@/lib/kas-store";

export async function GET(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!canAccessKas(authResult.user, authResult.adminDojoGrants)) {
    return NextResponse.json({ error: "Tidak berhak membuka Kas" }, { status: 403 });
  }

  try {
    const scope = await resolveKasScope(authResult.user);
    const url = new URL(request.url);
    const fromRaw = (url.searchParams.get("from") || "").trim();
    const toRaw = (url.searchParams.get("to") || "").trim();
    const year = Number(url.searchParams.get("year") || "") || null;
    const month = Number(url.searchParams.get("month") || "") || null;
    const iso = (s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "");
    let from = iso(fromRaw);
    let to = iso(toRaw);
    if (!from && !to && year && month) {
      const b = monthBounds(year, month);
      from = b.from;
      to = b.to;
    }
    if (from && to && from > to) {
      const swap = from;
      from = to;
      to = swap;
    }
    const kegiatan = (url.searchParams.get("kegiatan") || "").trim();
    const source = (url.searchParams.get("source") || "all").trim();
    const recon = (url.searchParams.get("recon") || "all").trim();

    const all = await listKasEntries(scope);
    const opening = from ? sumBefore(all, from) : 0;
    let filtered = filterRange(all, from || null, to || null);
    if (kegiatan) {
      filtered = filtered.filter((r) => r.kegiatan === kegiatan);
    }
    if (source !== "all") {
      filtered = filtered.filter((r) => r.sourceType === source);
    }
    if (recon !== "all") {
      filtered = filtered.filter((r) => r.reconStatus === recon);
    }
    const rows = withRunningSaldo(filtered, opening);
    const kpis = kasKpis(rows, opening);
    kpis.unmatched = rows.filter((r) => r.reconStatus !== "matched").length;
    const kegiatanOptions = Array.from(
      new Set(all.map((r) => r.kegiatan).filter(Boolean)),
    ).sort();
    const locks = await listKasLocks(scope);
    const lockedMonths = locks
      .filter((l) => !l.unlockedAt)
      .map((l) => l.yearMonth);

    return NextResponse.json({
      success: true,
      scope,
      canWrite: canWriteKas(authResult.user, authResult.adminDojoGrants),
      canLock: authResult.user.roles?.includes("ADMIN_BRANCH") ||
        authResult.user.roles?.includes("ADMINISTRATOR") ||
        authResult.user.roles?.includes("ADMIN_PUSAT") ||
        authResult.user.roles?.includes("ADMIN_PROVINCE"),
      rows,
      groups: groupKasTable(rows),
      kpis,
      kegiatanOptions,
      lockedMonths,
      currentMonth: yearMonthWib(),
    });
  } catch (error) {
    const msg = error instanceof KasScopeError ? error.message : "Gagal memuat kas";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (!canWriteKas(authResult.user, authResult.adminDojoGrants)) {
    return NextResponse.json({ error: "Tidak berhak menambah kas" }, { status: 403 });
  }

  const rlKey = `kas:post:${authResult.user.id}`;
  const limited = await rateLimitAsync(rlKey, { max: 40, windowMs: 60_000 });
  if (!limited.success) {
    return rateLimitResponse(limited.retryAfterSec ?? 60, rlKey);
  }

  const parsed = kasPostSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Data kas tidak valid" }, { status: 400 });
  }
  if (parsed.data.entries.length > KAS_MAX_BATCH) {
    return NextResponse.json({ error: `Maksimal ${KAS_MAX_BATCH} baris` }, { status: 400 });
  }

  try {
    const scope = await resolveKasScope(authResult.user);
    const result = await postKasBatch(
      parsed.data.entries.map((e, i) => ({
        scope,
        txnDate: e.txnDate,
        description: e.description,
        kegiatan: e.kegiatan,
        direction: e.direction,
        amount: e.amount,
        sourceType: parsed.data.sourceType ?? "manual",
        sourceId:
          parsed.data.sourceId && parsed.data.entries.length === 1
            ? parsed.data.sourceId
            : `${parsed.data.sourceId ?? "manual"}:${randomUUID()}:${i}`,
        createdById: authResult.user.id,
      })),
    );
    return NextResponse.json({ success: true, created: result.created });
  } catch (error) {
    if (error instanceof KasPeriodLockedError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    const msg = error instanceof Error ? error.message : "Gagal menyimpan kas";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
