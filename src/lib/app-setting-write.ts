import { inkaiFetch } from "@/lib/inkai-api/server";
import { prisma, prismaUserFacingError } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/**
 * Tulis AppSetting Prisma-first, lalu best-effort sync ke Inkai `/v1/settings`.
 * Dipakai agar aksi admin (setoran, waiver, meta, hari-H) tetap sukses
 * saat JWT Inkai di sesi sudah expired.
 */
export async function putAppSettingPrismaFirst(opts: {
  key: string;
  value: Prisma.InputJsonValue;
  token: string;
  label?: string;
}): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const label = opts.label ?? "app-setting";
  try {
    await prisma.appSetting.upsert({
      where: { key: opts.key },
      create: { key: opts.key, value: opts.value },
      update: { value: opts.value },
    });
  } catch (error) {
    console.error(`[${label}] prisma upsert`, error);
    const mapped = prismaUserFacingError(
      error,
      "Gagal menyimpan pengaturan ke database",
    );
    return { ok: false, error: mapped.error, status: mapped.status };
  }

  try {
    const { res, data } = await inkaiFetch(
      `/v1/settings/${encodeURIComponent(opts.key)}`,
      { method: "PUT", body: JSON.stringify({ value: opts.value }) },
      opts.token,
      { timeoutMs: 8_000, retries: 0 },
    );
    if (!res.ok) {
      console.warn(
        `[${label}] Inkai settings PUT failed (Prisma already saved)`,
        res.status,
        data,
      );
    }
  } catch (error) {
    console.warn(
      `[${label}] Inkai settings PUT error (Prisma already saved)`,
      error,
    );
  }

  return { ok: true };
}
