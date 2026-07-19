/** Pecah aksi bulk agar tidak timeout; chunk kecil = progress lebih halus. */
export const BULK_MEMBER_CHUNK_SIZE = 25;

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

/** Kirim POST /api/admin/members/bulk per chunk, gabungkan hasil. */
export async function postMemberBulkChunked(
  payload: Record<string, unknown> & { memberIds: string[] },
  opts?: { onProgress?: (p: BulkProgress) => void },
): Promise<BulkResult> {
  const total = payload.memberIds.length;
  const chunks = chunkIds(payload.memberIds);
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

  for (const memberIds of chunks) {
    const res = await fetch("/api/admin/members/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, memberIds }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      okCount?: number;
      failCount?: number;
      message?: string;
      error?: string;
    };
    lastStatus = res.status;
    if (!res.ok) {
      lastError = data.error || "Gagal memproses bulk";
      failCount += memberIds.length;
    } else {
      anyOk = true;
      okCount += Number(data.okCount ?? memberIds.length);
      failCount += Number(data.failCount ?? 0);
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
