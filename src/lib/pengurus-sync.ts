import { inkaiFetch } from "@/lib/inkai-api/server";
import { SITE_BRANCH_NAME, SITE_PROVINCE_NAME } from "@/lib/site";
import { prisma } from "@/lib/prisma";
import {
  fetchPengurusStore,
  savePeriod,
} from "@/lib/pengurus-settings";
import { getActivePeriod } from "@/lib/struktur-pengurus";
import { revalidatePath, revalidateTag } from "next/cache";
import { PENGURUS_CACHE_TAG } from "@/lib/struktur-pengurus";

export async function resolveSurabayaBranch(token: string) {
  const { res, data } = await inkaiFetch("/v1/org/provinces", {}, token);
  if (!res.ok) return null;

  const provinces = (data.data as Array<Record<string, unknown>>) ?? [];
  const province = provinces.find(
    (p) => String(p.name).toUpperCase() === SITE_PROVINCE_NAME.toUpperCase(),
  );
  const branches = (province?.branches as Array<Record<string, unknown>>) ?? [];
  const branch = branches.find(
    (b) => String(b.name).toUpperCase() === SITE_BRANCH_NAME.toUpperCase(),
  );
  if (!branch?.id) return null;
  return {
    id: String(branch.id),
    headName: (branch.headName as string | null) ?? null,
    name: String(branch.name ?? SITE_BRANCH_NAME),
  };
}

export async function syncKetuaToBranch(
  token: string,
  ketuaName: string,
): Promise<{ ok: boolean; branchId?: string; error?: string }> {
  const name = ketuaName.trim();
  if (!name) return { ok: false, error: "Nama ketua kosong" };

  try {
    const branch = await resolveSurabayaBranch(token);
    if (!branch) {
      return { ok: false, error: "Cabang Surabaya tidak ditemukan" };
    }

    const patch = await inkaiFetch(
      `/v1/org/branches/${branch.id}`,
      { method: "PATCH", body: JSON.stringify({ headName: name }) },
      token,
    );

    if (!patch.res.ok) {
      return { ok: false, error: "Gagal memperbarui ketua cabang di API" };
    }

    try {
      await prisma.branch.updateMany({
        where: {
          isDeleted: false,
          name: { equals: SITE_BRANCH_NAME, mode: "insensitive" },
          province: {
            name: { equals: SITE_PROVINCE_NAME, mode: "insensitive" },
          },
        },
        data: { headName: name },
      });
    } catch (error) {
      console.error("[syncKetuaToBranch] prisma", error);
    }

    return { ok: true, branchId: branch.id };
  } catch (error) {
    console.error("[syncKetuaToBranch]", error);
    return { ok: false, error: "Sinkron ketua gagal" };
  }
}

/** Cabang → Pengurus: update nama ketua periode aktif. */
export async function syncKetuaFromBranch(
  headName: string,
): Promise<{ ok: boolean; updated?: boolean; error?: string }> {
  const name = headName.trim();
  if (!name) return { ok: false, error: "Nama ketua kosong" };

  try {
    const store = await fetchPengurusStore(true);
    const active = getActivePeriod(store);
    if (active.inti.ketua.name === name) {
      return { ok: true, updated: false };
    }

    await savePeriod({
      ...active,
      inti: {
        ...active.inti,
        ketua: { ...active.inti.ketua, name },
      },
      updatedAt: new Date().toISOString(),
    });

    revalidateTag(PENGURUS_CACHE_TAG, "max");
    revalidatePath("/struktur");
    revalidatePath("/admin/organisasi");

    return { ok: true, updated: true };
  } catch (error) {
    console.error("[syncKetuaFromBranch]", error);
    return { ok: false, error: "Gagal menyelaraskan ke susunan pengurus" };
  }
}
