import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { BookOpen, Shield, Users, Target, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import ArticleCarousel from "@/components/home/ArticleCarousel";
import ArticleCarouselSkeleton from "@/components/home/ArticleCarouselSkeleton";
import HomeHeroCTA from "@/components/home/HomeHeroCTA";
import SurabayaHeroMark from "@/components/home/SurabayaHeroMark";

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
        <div className="inkai-hero-grid absolute inset-0 opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/15" />
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-inkai-red/20 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-inkai-yellow/10 blur-3xl" />

        <div className="relative mx-auto flex max-w-7xl flex-col items-center gap-10 px-4 py-16 sm:gap-12 sm:px-6 sm:py-28 lg:flex-row lg:gap-16 lg:py-36">
          <div className="relative order-first flex-shrink-0 lg:order-last">
            <div className="absolute -inset-8 rounded-full bg-inkai-yellow/15 blur-3xl" />
            <div className="absolute -inset-2 rounded-full bg-inkai-red/20 blur-xl" />
            <div className="relative rounded-full bg-gradient-to-br from-white/25 to-white/5 p-1.5 shadow-2xl ring-1 ring-white/25 backdrop-blur-sm">
              <Image
                src="/logo-inkai.png"
                alt="Logo INKAI"
                width={260}
                height={260}
                className="h-36 w-36 rounded-full sm:h-[220px] sm:w-[220px] lg:h-[260px] lg:w-[260px]"
                priority
              />
            </div>
          </div>

          <div className="flex-1 text-center lg:text-left">
            <h1 className="mb-6 text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
              Institut Karate-Do
              <span className="mt-1.5 block bg-gradient-to-r from-inkai-yellow via-amber-200 to-inkai-yellow bg-clip-text text-transparent">
                Indonesia
              </span>
            </h1>
            <SurabayaHeroMark />
            <p className="mb-10 max-w-xl text-base leading-relaxed text-white/78 sm:text-lg lg:text-xl">
              Membentuk karateka berintegritas, tangguh, dan rendah hati melalui
              disiplin, dedikasi, dan nilai-nilai budo karate.
            </p>
            <HomeHeroCTA />
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-background via-background/80 to-transparent" />
      </section>

      <section className="relative py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-14 text-center">
            <Badge
              variant="outline"
              className="mb-4 border-inkai-red/20 bg-inkai-red/5 text-inkai-red"
            >
              Tentang INKAI
            </Badge>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Karate-Do untuk Generasi Tangguh
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
              Kenali lebih dekat organisasi, nilai, dan perjalanan INKAI Cabang Surabaya.
            </p>
            <span
              className="mx-auto mt-6 block h-px w-24 bg-gradient-to-r from-transparent via-inkai-red/40 to-transparent"
              aria-hidden
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                className="inkai-card-hover group flex flex-col rounded-2xl border border-border/70 bg-card/90 p-6 shadow-sm backdrop-blur-sm"
              >
                <div
                  className={`mb-5 inline-flex size-11 items-center justify-center rounded-xl bg-gradient-to-br ring-1 ring-black/[0.03] dark:ring-white/5 ${item.accent}`}
                >
                  <item.icon className="size-5" />
                </div>
                <h3 className="mb-2 font-semibold tracking-tight transition-colors group-hover:text-inkai-red">
                  {item.title}
                </h3>
                <p className="mb-4 flex-1 text-sm leading-relaxed text-muted-foreground">
                  {item.desc}
                </p>
                <span className="inline-flex items-center gap-1 text-sm font-medium text-inkai-red opacity-0 transition-opacity group-hover:opacity-100 max-sm:opacity-70">
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
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(245,197,24,0.1)_0%,transparent_70%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-inkai-yellow/40 to-transparent" />
        <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-inkai-yellow">
            Motto INKAI
          </p>
          <blockquote className="text-xl font-medium leading-relaxed text-white/90 sm:text-2xl lg:text-[1.75rem]">
            &ldquo;Karate-Ka INKAI senantiasa memiliki Integritas tinggi,
            Tangguh dan Rendah Hati&rdquo;
          </blockquote>
        </div>
      </section>
    </>
  );
}
