import type { Metadata } from "next";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Makna Lambang",
};

const symbols = [
  {
    color: "bg-inkai-red",
    title: "Merah",
    meaning: "Melambangkan Keberanian",
    desc: "Warna merah pada bagian atas melambangkan semangat keberanian dan kekuatan dalam menghadapi setiap tantangan.",
  },
  {
    color: "bg-white border-2 border-border",
    title: "Putih",
    meaning: "Melambangkan Kesucian",
    desc: "Warna putih melambangkan kesucian hati, niat yang tulus, dan kejujuran dalam setiap gerakan karate.",
    textDark: true,
  },
  {
    color: "bg-inkai-black",
    title: "Hitam (Sabuk)",
    meaning: "Keteguhan Tekad & Percaya Diri",
    desc: "Sabuk hitam di tengah lambang melambangkan keteguhan tekad dan percaya diri yang dibangun melalui latihan disiplin.",
  },
  {
    color: "bg-inkai-yellow",
    title: "Kuning",
    meaning: "Keanggunan Kepribadian",
    desc: "Lingkaran kuning melambangkan keanggunan kepribadian yang terbentuk melalui pendidikan karate-do.",
    textDark: true,
  },
];

export default function MaknaLambangPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
      <Badge className="mb-4 bg-inkai-yellow/20 text-inkai-black hover:bg-inkai-yellow/20">
        Makna Lambang
      </Badge>
      <h1 className="mb-4 text-3xl font-bold sm:text-4xl">
        Makna Lambang INKAI
      </h1>
      <p className="mb-10 max-w-2xl text-muted-foreground">
        Setiap elemen dalam lambang INKAI memiliki makna filosofis yang
        mendalam, mencerminkan nilai-nilai budo karate.
      </p>

      <div className="mb-12 flex justify-center">
        <Image
          src="/makna-lambang.png"
          alt="Makna Lambang INKAI"
          width={600}
          height={400}
          className="rounded-2xl shadow-lg"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {symbols.map((symbol) => (
          <Card key={symbol.title} className="overflow-hidden">
            <div className={`h-2 ${symbol.color}`} />
            <CardContent className="p-6">
              <div className="mb-3 flex items-center gap-3">
                <div
                  className={`h-8 w-8 rounded-full ${symbol.color} ${symbol.textDark ? "border" : ""}`}
                />
                <div>
                  <h3 className="font-bold">{symbol.title}</h3>
                  <p className="text-sm font-medium text-inkai-red">
                    {symbol.meaning}
                  </p>
                </div>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {symbol.desc}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-12 rounded-2xl bg-inkai-yellow/15 p-8 text-center">
        <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-inkai-red">
          Motto INKAI
        </p>
        <p className="text-lg font-medium italic sm:text-xl">
          &ldquo;Karate-Ka INKAI senantiasa memiliki Integritas tinggi,
          Tangguh dan Rendah Hati&rdquo;
        </p>
      </div>
    </div>
  );
}
