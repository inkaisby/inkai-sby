import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Target, Eye } from "lucide-react";

export const metadata: Metadata = {
  title: "Visi & Misi",
};

export default function VisiMisiPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      <Badge className="mb-4 bg-inkai-red/10 text-inkai-red hover:bg-inkai-red/10">
        Visi & Misi
      </Badge>
      <h1 className="mb-10 text-3xl font-bold sm:text-4xl">Visi & Misi INKAI</h1>

      <div className="space-y-6">
        <Card className="overflow-hidden border-inkai-red/20">
          <div className="h-1 bg-inkai-red" />
          <CardContent className="p-8">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-xl bg-inkai-red/10 p-3">
                <Eye className="h-6 w-6 text-inkai-red" />
              </div>
              <h2 className="text-2xl font-bold">Visi</h2>
            </div>
            <p className="text-lg leading-relaxed text-muted-foreground">
              Menjadi organisasi karate-do terdepan di Indonesia yang
              melahirkan karateka berintegritas, tangguh, rendah hati, dan
              berprestasi di tingkat nasional maupun internasional.
            </p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-inkai-yellow/30">
          <div className="h-1 bg-inkai-yellow" />
          <CardContent className="p-8">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-xl bg-inkai-yellow/20 p-3">
                <Target className="h-6 w-6 text-inkai-black" />
              </div>
              <h2 className="text-2xl font-bold">Misi</h2>
            </div>
            <ul className="space-y-4">
              {[
                "Mengembangkan dan melestarikan seni bela diri karate-do di seluruh Indonesia.",
                "Membentuk karateka yang disiplin, berakhlak mulia, dan siap berkompetisi.",
                "Menyelenggarakan pelatihan, ujian kenaikan sabuk, dan kompetisi berkala.",
                "Membangun jaringan organisasi yang terstruktur dari pusat hingga dojo/ranting.",
                "Mengintegrasikan nilai-nilai budo karate dalam kehidupan sehari-hari anggota.",
              ].map((item, i) => (
                <li key={i} className="flex gap-3 text-muted-foreground">
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-inkai-red text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  <span className="leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <div className="rounded-2xl bg-inkai-black p-8 text-center text-white">
          <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-inkai-yellow">
            Nilai Inti
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            {["Integritas", "Tangguh", "Rendah Hati"].map((val) => (
              <span
                key={val}
                className="rounded-full border border-inkai-yellow/30 px-5 py-2 font-semibold text-inkai-yellow"
              >
                {val}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
