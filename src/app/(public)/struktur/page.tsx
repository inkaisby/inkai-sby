import type { Metadata } from "next";
import { getBranchStructure } from "@/lib/public-data";
import { getPengurusStruktur } from "@/lib/pengurus-settings";
import { PublicPageHeader } from "@/components/layout/PublicPageHeader";
import StrukturTabs from "@/components/struktur/StrukturTabs";

export const metadata: Metadata = {
  title: "Struktur Organisasi",
  description:
    "Struktur organisasi INKAI Cabang Surabaya — dojo dan ranting di bawah Provinsi Jawa Timur.",
};

export const revalidate = 60;

export default async function StrukturPage() {
  const [branch, pengurus] = await Promise.all([
    getBranchStructure(),
    getPengurusStruktur(),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
      <PublicPageHeader
        badge="Struktur Organisasi"
        title="Struktur Organisasi INKAI Surabaya"
        description="Hierarki organisasi Cabang Surabaya di bawah INKAI Provinsi Jawa Timur, dari tingkat cabang hingga dojo/ranting."
      />

      <StrukturTabs branch={branch} pengurus={pengurus} />
    </div>
  );
}
