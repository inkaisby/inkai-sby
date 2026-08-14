import { prisma } from "@/lib/prisma";
import { SITE_PROVINCE_NAME } from "@/lib/site";
import { fetchPengurusStore } from "@/lib/pengurus-settings";
import { getActivePeriod } from "@/lib/struktur-pengurus";

/** Prefill pejabat TTD dari Organisasi (Pengprov + susunan cabang). */
export async function loadUktTtdOrgHints(): Promise<{
  pengprovHeadName: string | null;
  strukturKetuaName: string | null;
}> {
  const [province, store] = await Promise.all([
    prisma.province.findFirst({
      where: {
        isDeleted: false,
        name: { equals: SITE_PROVINCE_NAME, mode: "insensitive" },
      },
      select: { headName: true },
    }),
    fetchPengurusStore(true).catch(() => null),
  ]);
  const strukturKetuaName = store
    ? getActivePeriod(store).inti.ketua.name?.trim() || null
    : null;
  return {
    pengprovHeadName: province?.headName?.trim() || null,
    strukturKetuaName,
  };
}
