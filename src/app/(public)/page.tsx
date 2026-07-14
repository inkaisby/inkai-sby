import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { BookOpen, Shield, Users, Target, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ArticleCarousel from "@/components/home/ArticleCarousel";
import ArticleCarouselSkeleton from "@/components/home/ArticleCarouselSkeleton";

export const revalidate = 60;

const features = [
  {
    title: "Sejarah",
    desc: "Perjalanan INKAI dari masa ke masa",
    href: "/sejarah",
    icon: BookOpen,
    accent: "from-inkai-red/15 to-inkai-red/5 text-inkai-red",
  },
  {
    title: "Makna Lambang",
    desc: "Filosofi setiap elemen lambang INKAI",
    href: "/makna-lambang",
    icon: Shield,
    accent: "from-inkai-yellow/25 to-inkai-yellow/5 text-amber-700 dark:text-inkai-yellow",
  },
  {
    title: "Struktur Organisasi",
    desc: "Dojo dan ranting Cabang Surabaya",
    href: "/struktur",
    icon: Users,
    accent: "from-foreground/10 to-foreground/5 text-foreground",
  },
  {
    title: "Visi & Misi",
    desc: "Arah dan tujuan organisasi INKAI",
    href: "/visi-misi",
    icon: Target,
    accent: "from-inkai-red/15 to-inkai-red/5 text-inkai-red",
  },
];

export default function HomePage() {
  return (
    <>
      <section className="inkai-hero relative overflow-hidden text-white">
        <div className="inkai-hero-grid absolute inset-0 opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/10" />
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-inkai-red/20 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-inkai-yellow/10 blur-3xl" />

        <div className="relative mx-auto flex max-w-7xl flex-col items-center gap-10 px-4 py-24 sm:px-6 sm:py-28 lg:flex-row lg:gap-16 lg:py-36">
          <div className="flex-1 text-center lg:text-left">
            <Badge className="mb-5 border border-inkai-yellow/30 bg-inkai-yellow/15 px-3 py-1 text-inkai-yellow shadow-sm backdrop-blur-sm hover:bg-inkai-yellow/15">
              Cabang Surabaya
            </Badge>
            <h1 className="mb-5 text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
              Institut Karate-Do
              <span className="mt-1 block bg-gradient-to-r from-inkai-yellow via-amber-300 to-inkai-yellow bg-clip-text text-transparent">
                Indonesia
              </span>
            </h1>
            <p className="mb-10 max-w-xl text-lg leading-relaxed text-white/80 sm:text-xl">
              Membentuk karateka berintegritas, tangguh, dan rendah hati melalui
              disiplin, dedikasi, dan nilai-nilai budo karate.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
              <Button
                asChild
                size="lg"
                className="h-12 rounded-xl bg-inkai-yellow px-8 text-base font-semibold text-inkai-black shadow-lg shadow-inkai-yellow/25 transition-all hover:bg-inkai-yellow/90 hover:shadow-xl hover:shadow-inkai-yellow/30"
              >
                <Link href="/daftar">Daftar Anggota</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 rounded-xl border-white/25 bg-white/5 px-8 text-base font-medium text-white backdrop-blur-sm transition-all hover:border-white/40 hover:bg-white/15 hover:text-white"
              >
                <Link href="/sejarah">Pelajari Sejarah</Link>
              </Button>
            </div>
          </div>

          <div className="relative flex-shrink-0">
            <div className="absolute -inset-8 rounded-full bg-inkai-yellow/15 blur-3xl" />
            <div className="absolute -inset-2 rounded-full bg-inkai-red/20 blur-xl" />
            <div className="relative rounded-full bg-gradient-to-br from-white/20 to-white/5 p-1 shadow-2xl ring-1 ring-white/20 backdrop-blur-sm">
              <Image
                src="/logo-inkai.png"
                alt="Logo INKAI"
                width={260}
                height={260}
                className="rounded-full"
                priority
              />
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent" />
      </section>

      <section className="inkai-section-muted py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-14 text-center">
            <Badge
              variant="outline"
              className="mb-4 border-inkai-red/20 bg-inkai-red/5 text-inkai-red"
            >
              Tentang INKAI
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Karate-Do untuk Generasi Tangguh
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
              Kenali lebih dekat organisasi, nilai, dan perjalanan INKAI Cabang Surabaya.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                className="inkai-card-hover group flex flex-col rounded-2xl border bg-card p-6 shadow-sm"
              >
                <div
                  className={`mb-5 inline-flex size-11 items-center justify-center rounded-xl bg-gradient-to-br ${item.accent}`}
                >
                  <item.icon className="size-5" />
                </div>
                <h3 className="mb-2 font-semibold group-hover:text-inkai-red transition-colors">
                  {item.title}
                </h3>
                <p className="mb-4 flex-1 text-sm leading-relaxed text-muted-foreground">
                  {item.desc}
                </p>
                <span className="inline-flex items-center gap-1 text-sm font-medium text-inkai-red opacity-0 transition-opacity group-hover:opacity-100">
                  Selengkapnya
                  <ArrowRight className="size-3.5" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <Suspense fallback={<ArticleCarouselSkeleton />}>
        <ArticleCarousel />
      </Suspense>

      <section className="relative overflow-hidden bg-inkai-black py-20 text-white sm:py-24">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(245,197,24,0.08)_0%,transparent_70%)]" />
        <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-inkai-yellow">
            Motto INKAI
          </p>
          <blockquote className="text-xl font-medium italic leading-relaxed text-white/90 sm:text-2xl lg:text-3xl">
            &ldquo;Karate-Ka INKAI senantiasa memiliki Integritas tinggi,
            Tangguh dan Rendah Hati&rdquo;
          </blockquote>
        </div>
      </section>
    </>
  );
}
