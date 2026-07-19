/** Pecah aksi bulk agar tidak kena batas validasi / timeout. */
export const BULK_MEMBER_CHUNK_SIZE = 100;

export function chunkIds(ids: string[], size = BULK_MEMBER_CHUNK_SIZE): string[][] {
  if (ids.length === 0) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += size) {
    chunks.push(ids.slice(i, i + size));
  }
  return chunks;
}

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
): Promise<BulkResult> {
  const chunks = chunkIds(payload.memberIds);
  let okCount = 0;
  let failCount = 0;
  let lastMessage = "";
  let lastError = "";
  let anyOk = false;
  let lastStatus = 400;

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
      continue;
    }
    anyOk = true;
    okCount += Number(data.okCount ?? memberIds.length);
    failCount += Number(data.failCount ?? 0);
    lastMessage = data.message || lastMessage;
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
