import type { Metadata } from "next";
import { PublicPageHeader } from "@/components/layout/PublicPageHeader";

export const metadata: Metadata = {
  title: "Sejarah",
};

export default function SejarahPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      <PublicPageHeader badge="Sejarah" title="Sejarah INKAI Surabaya" />

      <div className="prose prose-neutral max-w-none space-y-6 text-muted-foreground">
        <p className="text-lg leading-relaxed text-foreground">
          <strong className="text-inkai-red">Institut Karate-Do Indonesia (INKAI)</strong>{" "}
          adalah organisasi karate nasional yang berdiri dengan tujuan
          mengembangkan dan melestarikan seni bela diri karate di seluruh
          Indonesia.
        </p>

        <div className="rounded-2xl border-l-4 border-inkai-red bg-inkai-red/5 p-6">
          <h2 className="mb-3 text-xl font-semibold text-foreground">
            Awal Mula
          </h2>
          <p className="leading-relaxed">
            INKAI didirikan oleh para pendekar karate Indonesia yang
            berkomitmen untuk membawa karate-do ke masyarakat luas dengan
            pendekatan yang sistematis dan terstruktur. Organisasi ini
            mengadopsi kurikulum karate tradisional yang disesuaikan dengan
            karakter bangsa Indonesia.
          </p>
        </div>

        <div className="rounded-2xl border-l-4 border-inkai-yellow bg-inkai-yellow/10 p-6">
          <h2 className="mb-3 text-xl font-semibold text-foreground">
            INKAI di Surabaya
          </h2>
          <p className="leading-relaxed">
            Cabang Surabaya merupakan salah satu cabang aktif di Jawa Timur
            dengan puluhan dojo/ranting yang tersebar di berbagai wilayah
            kota Surabaya. Sejak berdirinya, INKAI Surabaya telah melahirkan
            banyak karateka berprestasi di tingkat regional maupun nasional.
          </p>
        </div>

        <div className="rounded-2xl border-l-4 border-inkai-black bg-muted p-6">
          <h2 className="mb-3 text-xl font-semibold text-foreground">
            Perkembangan
          </h2>
          <p className="leading-relaxed">
            Hingga saat ini, INKAI Surabaya terus berkembang dengan sistem
            organisasi hierarkis: Pusat (Nasional) → Provinsi → Cabang →
            Dojo/Ranting → Anggota. Struktur ini memastikan pengelolaan yang
            efektif dan pengembangan karateka di setiap level.
          </p>
        </div>
      </div>
    </div>
  );
}
