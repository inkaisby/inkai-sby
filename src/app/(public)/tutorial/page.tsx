import type { Metadata } from "next";
import Link from "next/link";
import { PublicPageHeader } from "@/components/layout/PublicPageHeader";
import { TutorialSections } from "@/components/tutorial/TutorialSections";
import { getMemberTutorials } from "@/lib/memberTutorials";

export const metadata: Metadata = {
  title: "Tutorial",
  description:
    "Tutorial anggota INKAI Cabang Surabaya: pendaftaran, menu dashboard, UKT, iuran, dan absensi.",
};

export default function TutorialPage() {
  const tutorials = getMemberTutorials();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <PublicPageHeader
        badge="Tutorial"
        title={tutorials.title}
        description={tutorials.subtitle}
      />

      <div className="mb-8 flex flex-wrap gap-3">
        <Link
          href="/login?tab=daftar"
          className="inline-flex items-center justify-center rounded-xl bg-inkai-red px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-inkai-red/20 hover:bg-inkai-red/90"
        >
          Daftar anggota
        </Link>
        <Link
          href="/login"
          className="inline-flex items-center justify-center rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold hover:bg-muted/50"
        >
          Masuk
        </Link>
      </div>

      <TutorialSections data={tutorials} />
    </div>
  );
}
