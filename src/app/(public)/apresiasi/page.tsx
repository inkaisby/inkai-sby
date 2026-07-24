import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { AppreciationKind } from "@prisma/client";
import {
  AppreciationCopyLink,
  AppreciationScrollTarget,
} from "@/components/appreciation/AppreciationDeepLink";
import { PublicPageHeader } from "@/components/layout/PublicPageHeader";
import { Badge } from "@/components/ui/badge";
import {
  appreciationKindLabel,
  appreciationPublicPath,
  appreciationSlug,
  findAppreciationByTokoh,
  formatAppreciationDate,
  listActiveAppreciations,
} from "@/lib/appreciation";
import { cn } from "@/lib/utils";

const PAGE_DESCRIPTION =
  "Menghormati yang mendahului dan merayakan pencapaian karateka INKAI Surabaya.";

export const revalidate = 60;

type Props = {
  searchParams: Promise<{ jenis?: string; tokoh?: string }>;
};

function parseKind(raw: string | undefined): AppreciationKind | null {
  if (raw === "kenangan") return "KENANGAN";
  if (raw === "prestasi") return "PRESTASI";
  return null;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams;
  const kind = parseKind(params.jenis);
  const items = await listActiveAppreciations(kind);
  const focused = findAppreciationByTokoh(items, params.tokoh);

  if (focused) {
    const excerpt =
      focused.summary.replace(/\s+/g, " ").trim().slice(0, 160) ||
      PAGE_DESCRIPTION;
    return {
      title: focused.name,
      description: focused.title
        ? `${focused.title} — ${excerpt}`
        : excerpt,
      openGraph: {
        title: focused.name,
        description: focused.title || PAGE_DESCRIPTION,
      },
    };
  }

  const kindLabel = kind ? appreciationKindLabel(kind) : null;
  return {
    title: kindLabel ? `Apresiasi · ${kindLabel}` : "Apresiasi",
    description: PAGE_DESCRIPTION,
  };
}

export default async function ApresiasiPage({ searchParams }: Props) {
  const params = await searchParams;
  const kind = parseKind(params.jenis);
  const items = await listActiveAppreciations(kind);
  const focused = findAppreciationByTokoh(items, params.tokoh);
  const highlightId = focused?.id ?? null;

  const filters = [
    { href: "/apresiasi", label: "Semua", active: !kind },
    {
      href: "/apresiasi?jenis=kenangan",
      label: "Kenangan",
      active: kind === "KENANGAN",
    },
    {
      href: "/apresiasi?jenis=prestasi",
      label: "Prestasi",
      active: kind === "PRESTASI",
    },
  ] as const;

  return (
    <div className="relative overflow-hidden">
      <AppreciationScrollTarget targetId={highlightId} />
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-inkai-red/[0.04] via-transparent to-inkai-yellow/[0.03]"
        aria-hidden
      />
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
        <PublicPageHeader
          badge="Apresiasi"
          title="Kenangan & Prestasi"
          description={PAGE_DESCRIPTION}
        />

        <div className="mb-8 flex flex-wrap gap-2">
          {filters.map((f) => (
            <Link
              key={f.href}
              href={f.href}
              prefetch
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                f.active
                  ? "border-inkai-red bg-inkai-red text-white"
                  : "border-border bg-card/80 text-muted-foreground hover:border-inkai-red/40 hover:text-foreground",
              )}
            >
              {f.label}
            </Link>
          ))}
        </div>

        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/80 bg-card/50 px-6 py-14 text-center">
            <span
              className="mx-auto mb-4 block h-px w-16 bg-gradient-to-r from-transparent via-inkai-red/40 to-transparent"
              aria-hidden
            />
            <p className="text-sm text-muted-foreground">
              Belum ada entri untuk filter ini.
            </p>
          </div>
        ) : (
          <ul className="space-y-4">
            {items.map((item) => {
              const dateLabel = formatAppreciationDate(item.eventDate);
              const isKenangan = item.kind === "KENANGAN";
              const isFocused = highlightId === item.id;
              const path = appreciationPublicPath(item);
              const slug = appreciationSlug(item.name);
              return (
                <li key={item.id} id={slug ? `tokoh-${slug}` : undefined}>
                  <article
                    id={`apresiasi-${item.id}`}
                    className={cn(
                      "overflow-hidden rounded-2xl border transition-colors scroll-mt-24",
                      isKenangan
                        ? "border-border/70 bg-muted/25 hover:border-border"
                        : "border-inkai-red/15 bg-card/90 hover:border-inkai-red/30",
                      isFocused &&
                        "ring-2 ring-inkai-red/35 border-inkai-red/40",
                    )}
                  >
                    <div className="flex gap-4 p-5 sm:gap-5 sm:p-6">
                      <span
                        className={cn(
                          "mt-1 hidden w-1 shrink-0 self-stretch rounded-full sm:block",
                          isKenangan
                            ? "bg-foreground/20"
                            : "bg-gradient-to-b from-inkai-red to-inkai-yellow/80",
                        )}
                        aria-hidden
                      />
                      {item.photoUrl ? (
                        <div className="relative size-16 shrink-0 overflow-hidden rounded-full ring-1 ring-border/60 sm:size-20">
                          <Image
                            src={item.photoUrl}
                            alt={item.name}
                            fill
                            className="object-cover"
                            sizes="80px"
                            unoptimized
                          />
                        </div>
                      ) : (
                        <div
                          className={cn(
                            "flex size-16 shrink-0 items-center justify-center rounded-full text-lg font-semibold sm:size-20",
                            isKenangan
                              ? "bg-foreground/10 text-foreground/70"
                              : "bg-inkai-red/10 text-inkai-red",
                          )}
                        >
                          {item.name.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="mb-1.5 flex flex-wrap items-center gap-2">
                          <Badge
                            variant="outline"
                            className={
                              isKenangan
                                ? "border-foreground/20 text-foreground/70"
                                : "border-inkai-red/25 bg-inkai-red/5 text-inkai-red"
                            }
                          >
                            {appreciationKindLabel(item.kind)}
                          </Badge>
                          {dateLabel ? (
                            <span className="text-xs text-muted-foreground">
                              {dateLabel}
                            </span>
                          ) : null}
                          <AppreciationCopyLink
                            path={path}
                            className="ml-auto sm:ml-0"
                          />
                        </div>
                        <h2 className="text-lg font-semibold tracking-tight">
                          <Link
                            href={path}
                            prefetch
                            className="hover:text-inkai-red transition-colors"
                          >
                            {item.name}
                          </Link>
                        </h2>
                        {item.title ? (
                          <p className="mt-0.5 text-sm font-medium text-muted-foreground">
                            {item.title}
                          </p>
                        ) : null}
                        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                          {item.summary}
                        </p>
                      </div>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
