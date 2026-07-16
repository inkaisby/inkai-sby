import type { Metadata } from "next";
import Link from "next/link";
import { fetchPengurusStore } from "@/lib/pengurus-settings";
import { getActivePeriod } from "@/lib/struktur-pengurus";
import SusunanPengurus from "@/components/struktur/SusunanPengurus";
import { PrintButton } from "./PrintButton";

export const metadata: Metadata = {
  title: "Cetak Susunan Pengurus",
  robots: { index: false, follow: false },
};

export const revalidate = 60;

type SearchParams = Promise<{ period?: string; autoprint?: string }>;

export default async function StrukturPrintPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const store = await fetchPengurusStore(false);
  const period =
    store.periods.find((p) => p.id === params.period && !p.isDeleted) ??
    getActivePeriod(store);
  const autoPrint = params.autoprint === "1";

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/struktur" className="text-sm text-inkai-red hover:underline">
          ← Kembali ke Struktur
        </Link>
        <PrintButton autoPrint={autoPrint} />
      </div>
      <SusunanPengurus pengurus={period} />
    </div>
  );
}
