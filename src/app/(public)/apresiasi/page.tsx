import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { AppreciationKind } from "@prisma/client";
import { PublicPageHeader } from "@/components/layout/PublicPageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  appreciationKindLabel,
  formatAppreciationDate,
  listActiveAppreciations,
} from "@/lib/appreciation";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Apresiasi",
  description:
    "Kenangan dan prestasi anggota serta pengurus INKAI Cabang Surabaya.",
};

export const revalidate = 60;

type Props = {
  searchParams: Promise<{ jenis?: string }>;
};

function parseKind(raw: string | undefined): AppreciationKind | null {
  if (raw === "kenangan") return "KENANGAN";
  if (raw === "prestasi") return "PRESTASI";
  return null;
}

export default async function ApresiasiPage({ searchParams }: Props) {
  const params = await searchParams;
  const kind = parseKind(params.jenis);
  const items = await listActiveAppreciations(kind);

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
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      <PublicPageHeader
        badge="Apresiasi"
        title="Kenangan & Prestasi"
        description="Menghormati yang mendahului dan merayakan pencapaian karateka INKAI Surabaya."
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
                : "border-border bg-card text-muted-foreground hover:border-inkai-red/40 hover:text-foreground",
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Belum ada entri untuk filter ini.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-4">
          {items.map((item) => {
            const dateLabel = formatAppreciationDate(item.eventDate);
            const isKenangan = item.kind === "KENANGAN";
            return (
              <li key={item.id}>
                <Card
                  className={cn(
                    "overflow-hidden border-border/70",
                    isKenangan && "bg-muted/30",
                  )}
                >
                  <CardContent className="flex gap-4 p-5 sm:gap-5 sm:p-6">
                    {item.photoUrl ? (
                      <div className="relative size-16 shrink-0 overflow-hidden rounded-full sm:size-20">
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
                      </div>
                      <h2 className="text-lg font-semibold tracking-tight">
                        {item.name}
                      </h2>
                      {item.title ? (
                        <p className="mt-0.5 text-sm font-medium text-muted-foreground">
                          {item.title}
                        </p>
                      ) : null}
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {item.summary}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
