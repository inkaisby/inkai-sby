import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  appreciationKindLabel,
  listHomeAppreciationSnippet,
} from "@/lib/appreciation";

export default async function HomeAppreciationSnippet() {
  const items = await listHomeAppreciationSnippet(4);
  if (items.length === 0) return null;

  return (
    <section className="relative py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-10 flex flex-col items-center gap-3 text-center sm:mb-12">
          <Badge
            variant="outline"
            className="border-inkai-red/20 bg-inkai-red/5 text-inkai-red"
          >
            Apresiasi
          </Badge>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Kenangan & Prestasi
          </h2>
          <p className="max-w-xl text-sm text-muted-foreground sm:text-base">
            Menghormati yang mendahului dan merayakan pencapaian karateka.
          </p>
          <span
            className="mt-2 block h-px w-20 bg-gradient-to-r from-transparent via-inkai-red/40 to-transparent"
            aria-hidden
          />
        </div>

        <ul className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-2">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href="/apresiasi"
                prefetch
                className="group flex items-center gap-3 rounded-2xl border border-border/70 bg-card/80 px-4 py-3 transition-colors hover:border-inkai-red/30"
              >
                {item.photoUrl ? (
                  <div className="relative size-12 shrink-0 overflow-hidden rounded-full">
                    <Image
                      src={item.photoUrl}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="48px"
                      priority={false}
                      unoptimized
                    />
                  </div>
                ) : (
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-inkai-red/10 text-sm font-semibold text-inkai-red">
                    {item.name.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1 text-left">
                  <p className="truncate text-[11px] font-semibold tracking-wide text-inkai-red uppercase">
                    {appreciationKindLabel(item.kind)}
                  </p>
                  <p className="truncate font-semibold group-hover:text-inkai-red">
                    {item.name}
                  </p>
                  {item.title ? (
                    <p className="truncate text-xs text-muted-foreground">
                      {item.title}
                    </p>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-8 text-center">
          <Link
            href="/apresiasi"
            prefetch
            className="inline-flex items-center gap-1.5 text-sm font-medium text-inkai-red hover:underline"
          >
            Lihat semua
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
