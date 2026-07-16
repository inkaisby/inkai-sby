import type { Metadata } from "next";
import { getBranchStructure } from "@/lib/public-data";
import { getPengurusStruktur } from "@/lib/pengurus-settings";
import { Badge } from "@/components/ui/badge";
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
      <Badge className="mb-4 bg-inkai-black/5 text-inkai-black hover:bg-inkai-black/5">
        Struktur Organisasi
      </Badge>
      <h1 className="mb-4 text-3xl font-bold sm:text-4xl">
        Struktur Organisasi INKAI Surabaya
      </h1>
      <p className="mb-8 max-w-2xl text-muted-foreground">
        Hierarki organisasi Cabang Surabaya di bawah INKAI Provinsi Jawa Timur,
        dari tingkat cabang hingga dojo/ranting.
      </p>

      <StrukturTabs branch={branch} pengurus={pengurus} />
    </div>
  );
}
