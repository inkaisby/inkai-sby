import { PRISMA_BUSY_USER_MESSAGE } from "@/lib/prisma-errors";

/**
 * Chunk besar untuk arsip cepat (server pakai updateMany).
 * Progress bar tetap update per chunk.
 */
export const BULK_MEMBER_CHUNK_SIZE = 50;

/** Chunk lebih kecil untuk hapus permanen (banyak relasi per anggota). */
export const BULK_PURGE_CHUNK_SIZE = 25;

/** Chunk input massal tambah anggota — 1 per request agar progress % naik per baris. */
export const BULK_CREATE_CHUNK_SIZE = 1;

/** Jeda singkat antar chunk (hampir nol — sinkron lokal sudah cepat). */
const CHUNK_PAUSE_MS = 50;

/** Jeda antar chunk purge agar pool sempat pulih. */
const PURGE_CHUNK_PAUSE_MS = 250;

export function chunkIds(ids: string[], size = BULK_MEMBER_CHUNK_SIZE): string[][] {
  if (ids.length === 0) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += size) {
    chunks.push(ids.slice(i, i + size));
  }
  return chunks;
}

export type BulkProgress = {
  done: number;
  total: number;
  percent: number;
  okCount: number;
  failCount: number;
};

type BulkResult = {
  ok: boolean;
  status: number;
  okCount: number;
  failCount: number;
  message: string;
  error?: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function looksBusy(error: string | undefined, status: number) {
  if (status === 503) return true;
  const lower = (error || "").toLowerCase();
  return (
    lower.includes("sibuk") ||
    lower.includes("max clients") ||
    lower.includes("connection")
  );
}

/** Kirim POST /api/admin/members/bulk per chunk, gabungkan hasil. */
export async function postMemberBulkChunked(
  payload: Record<string, unknown> & { memberIds: string[] },
  opts?: {
    onProgress?: (p: BulkProgress) => void;
    chunkSize?: number;
    pauseMs?: number;
  },
): Promise<BulkResult> {
  const total = payload.memberIds.length;
  const isPurge = payload.action === "purge";
  const chunkSize =
    opts?.chunkSize ??
    (isPurge ? BULK_PURGE_CHUNK_SIZE : BULK_MEMBER_CHUNK_SIZE);
  const pauseMs =
    opts?.pauseMs ?? (isPurge ? PURGE_CHUNK_PAUSE_MS : CHUNK_PAUSE_MS);
  const chunks = chunkIds(payload.memberIds, chunkSize);
  let okCount = 0;
  let failCount = 0;
  let lastMessage = "";
  let lastError = "";
  let anyOk = false;
  let lastStatus = 400;

  opts?.onProgress?.({
    done: 0,
    total,
    percent: 0,
    okCount: 0,
    failCount: 0,
  });

  for (let i = 0; i < chunks.length; i++) {
    const memberIds = chunks[i];
    let res = await fetch("/api/admin/members/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, memberIds }),
    });
    let data = (await res.json().catch(() => ({}))) as {
      okCount?: number;
      failCount?: number;
      message?: string;
      error?: string;
    };

    // Satu retry singkat jika pool sibuk.
    if (!res.ok && looksBusy(data.error, res.status)) {
      await sleep(isPurge ? 1500 : 800);
      res = await fetch("/api/admin/members/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, memberIds }),
      });
      data = (await res.json().catch(() => ({}))) as typeof data;
    }

    lastStatus = res.status;
    if (!res.ok) {
      lastError =
        data.error ||
        data.message ||
        (res.status === 503 || res.status >= 500
          ? PRISMA_BUSY_USER_MESSAGE
          : "Gagal memproses bulk");
      failCount += memberIds.length;
      // Hentikan sisa chunk agar tidak memperburuk pool.
      if (looksBusy(lastError, res.status)) {
        const remaining = chunks.slice(i + 1).reduce((n, c) => n + c.length, 0);
        failCount += remaining;
        break;
      }
    } else {
      const chunkOk = Number(data.okCount ?? 0);
      const chunkFail = Number(data.failCount ?? 0);
      // Jangan anggap sukses hanya karena HTTP 200 — okCount bisa 0 (filter/scope).
      if (chunkOk > 0) anyOk = true;
      okCount += chunkOk;
      failCount += chunkFail > 0 ? chunkFail : chunkOk === 0 ? memberIds.length : 0;
      lastMessage = data.message || lastMessage;
      if (chunkOk === 0 && (data.error || data.message)) {
        lastError = data.error || data.message || lastError;
      }
    }

    const done = Math.min(okCount + failCount, total);
    const percent =
      total === 0 ? 100 : Math.min(100, Math.round((done / total) * 100));
    opts?.onProgress?.({
      done,
      total,
      percent,
      okCount,
      failCount,
    });

    if (i < chunks.length - 1 && pauseMs > 0) {
      await sleep(pauseMs);
    }
  }

  if (!anyOk) {
    return {
      ok: false,
      status: lastStatus,
      okCount,
      failCount,
      message: lastError || "Gagal memproses bulk",
      error: lastError || "Gagal memproses bulk",
    };
  }

  return {
    ok: failCount === 0,
    status: 200,
    okCount,
    failCount,
    message:
      failCount === 0
        ? lastMessage || `${okCount} berhasil`
        : `${okCount} berhasil, ${failCount} gagal`,
  };
}

export type BulkCreateResultRow = {
  index: number;
  fullName: string;
  ok: boolean;
  error?: string;
  memberId?: string;
};

/** Kirim POST /api/admin/members/bulk-create per chunk, gabungkan hasil + progress. */
export async function postBulkCreateChunked(
  members: Record<string, unknown>[],
  opts?: {
    onProgress?: (p: BulkProgress) => void;
    chunkSize?: number;
    pauseMs?: number;
  },
): Promise<{
  ok: boolean;
  okCount: number;
  failCount: number;
  results: BulkCreateResultRow[];
  message: string;
  error?: string;
}> {
  const total = members.length;
  const chunkSize = opts?.chunkSize ?? BULK_CREATE_CHUNK_SIZE;
  const pauseMs = opts?.pauseMs ?? CHUNK_PAUSE_MS;
  const chunks: Record<string, unknown>[][] = [];
  for (let i = 0; i < members.length; i += chunkSize) {
    chunks.push(members.slice(i, i + chunkSize));
  }

  let okCount = 0;
  let failCount = 0;
  let lastMessage = "";
  let lastError = "";
  const allResults: BulkCreateResultRow[] = [];

  opts?.onProgress?.({
    done: 0,
    total,
    percent: 0,
    okCount: 0,
    failCount: 0,
  });

  for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
    const chunk = chunks[chunkIdx]!;
    const baseIndex = chunkIdx * chunkSize;

    // Progress "sedang memproses" sebelum request — agar UI tidak stuck di 0%.
    const processing = Math.min(baseIndex + chunk.length, total);
    const startedPercent =
      total === 0
        ? 100
        : Math.min(99, Math.round((baseIndex / total) * 100));
    opts?.onProgress?.({
      done: processing,
      total,
      percent: startedPercent,
      okCount,
      failCount,
    });
    // Yield ke browser agar progress bar ter-render sebelum fetch.
    await sleep(0);

    const res = await fetch("/api/admin/members/bulk-create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ members: chunk }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
      okCount?: number;
      failCount?: number;
      results?: BulkCreateResultRow[];
    };

    if (!res.ok && !data.results) {
      lastError = data.error || data.message || "Gagal menyimpan massal";
      for (let j = 0; j < chunk.length; j++) {
        const raw = chunk[j] as { fullName?: string };
        allResults.push({
          index: baseIndex + j,
          fullName: String(raw.fullName || ""),
          ok: false,
          error: lastError,
        });
      }
      failCount += chunk.length;
    } else {
      const chunkResults = data.results ?? [];
      for (const r of chunkResults) {
        allResults.push({
          ...r,
          index: baseIndex + r.index,
        });
      }
      const chunkOk = Number(data.okCount ?? chunkResults.filter((r) => r.ok).length);
      const chunkFail = Number(
        data.failCount ?? chunkResults.filter((r) => !r.ok).length,
      );
      okCount += chunkOk;
      failCount += chunkFail;
      lastMessage = data.message || lastMessage;
    }

    const done = Math.min(okCount + failCount, total);
    const percent =
      total === 0 ? 100 : Math.min(100, Math.round((done / total) * 100));
    opts?.onProgress?.({
      done,
      total,
      percent,
      okCount,
      failCount,
    });
    // Biarkan React paint (1/3 → 33%, dst.) sebelum anggota berikutnya.
    await sleep(16);

    if (chunkIdx < chunks.length - 1 && pauseMs > 0) {
      await sleep(pauseMs);
    }
  }

  const anyOk = okCount > 0;
  if (!anyOk) {
    return {
      ok: false,
      okCount,
      failCount,
      results: allResults,
      message: lastError || "Gagal menyimpan massal",
      error: lastError || "Gagal menyimpan massal",
    };
  }

  return {
    ok: failCount === 0,
    okCount,
    failCount,
    results: allResults,
    message:
      failCount === 0
        ? lastMessage || `${okCount} anggota berhasil ditambahkan`
        : `${okCount} berhasil, ${failCount} gagal`,
  };
}
