import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ArticleCarousel from "@/components/home/ArticleCarousel";

export default function HomePage() {
  return (
    <>
      <section className="inkai-gradient inkai-pattern relative overflow-hidden text-white">
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative mx-auto flex max-w-7xl flex-col items-center gap-8 px-4 py-20 sm:px-6 sm:py-28 lg:flex-row lg:py-32">
          <div className="flex-1 text-center lg:text-left">
            <Badge className="mb-4 bg-inkai-yellow/20 text-inkai-yellow hover:bg-inkai-yellow/20">
              Cabang Surabaya
            </Badge>
            <h1 className="mb-4 text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
              Institut Karate-Do
              <span className="block text-inkai-yellow">Indonesia</span>
            </h1>
            <p className="mb-8 max-w-xl text-lg text-white/85 sm:text-xl">
              Membentuk karateka berintegritas, tangguh, dan rendah hati melalui
              disiplin, dedikasi, dan nilai-nilai budo karate.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
              <Button
                asChild
                size="lg"
                className="bg-inkai-yellow text-inkai-black hover:bg-inkai-yellow/90"
              >
                <Link href="/daftar">Daftar Anggota</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
              >
                <Link href="/sejarah">Pelajari Sejarah</Link>
              </Button>
            </div>
          </div>
          <div className="relative flex-shrink-0">
            <div className="absolute -inset-4 rounded-full bg-inkai-yellow/20 blur-2xl" />
            <Image
              src="/logo-inkai.png"
              alt="Logo INKAI"
              width={280}
              height={280}
              className="relative rounded-full shadow-2xl ring-4 ring-inkai-yellow/30"
              priority
            />
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-12 text-center">
            <Badge className="mb-3 bg-inkai-red/10 text-inkai-red hover:bg-inkai-red/10">
              Tentang INKAI
            </Badge>
            <h2 className="text-2xl font-bold sm:text-3xl">
              Karate-Do untuk Generasi Tangguh
            </h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                title: "Sejarah",
                desc: "Perjalanan INKAI dari masa ke masa",
                href: "/sejarah",
                color: "bg-inkai-red/10 text-inkai-red",
              },
              {
                title: "Makna Lambang",
                desc: "Filosofi setiap elemen lambang INKAI",
                href: "/makna-lambang",
                color: "bg-inkai-yellow/20 text-inkai-black",
              },
              {
                title: "Struktur Organisasi",
                desc: "Dojo dan ranting Cabang Surabaya",
                href: "/struktur",
                color: "bg-inkai-black/5 text-inkai-black",
              },
              {
                title: "Visi & Misi",
                desc: "Arah dan tujuan organisasi INKAI",
                href: "/visi-misi",
                color: "bg-inkai-red/10 text-inkai-red",
              },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group rounded-2xl border bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md"
              >
                <div
                  className={`mb-4 inline-flex rounded-xl px-3 py-1.5 text-sm font-semibold ${item.color}`}
                >
                  {item.title}
                </div>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <ArticleCarousel />

      <section className="bg-inkai-black py-16 text-white sm:py-20">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-inkai-yellow">
            Motto INKAI
          </p>
          <blockquote className="text-xl font-medium italic leading-relaxed sm:text-2xl">
            &ldquo;Karate-Ka INKAI senantiasa memiliki Integritas tinggi,
            Tangguh dan Rendah Hati&rdquo;
          </blockquote>
        </div>
      </section>
    </>
  );
}
