import { PRISMA_BUSY_USER_MESSAGE } from "@/lib/prisma-errors";

/**
 * Chunk besar untuk arsip cepat (server pakai updateMany).
 * Progress bar tetap update per chunk.
 */
export const BULK_MEMBER_CHUNK_SIZE = 50;

/** Chunk lebih kecil untuk hapus permanen (banyak relasi per anggota). */
export const BULK_PURGE_CHUNK_SIZE = 25;

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
