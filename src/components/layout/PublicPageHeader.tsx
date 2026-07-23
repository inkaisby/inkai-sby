import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Header konten halaman publik — strip aksen + tipografi renggang. */
export function PublicPageHeader({
  badge,
  title,
  description,
  className,
}: {
  badge?: string;
  title: string;
  description?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-8 sm:mb-10", className)}>
      {badge ? (
        <Badge className="mb-4 border-0 bg-inkai-red/10 text-inkai-red hover:bg-inkai-red/10">
          {badge}
        </Badge>
      ) : null}
      <div className="flex items-start gap-3">
        <span
          className="mt-1.5 hidden h-8 w-1 shrink-0 rounded-full bg-gradient-to-b from-inkai-red to-inkai-yellow/80 sm:block"
          aria-hidden
        />
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-3 max-w-2xl text-muted-foreground leading-relaxed">
              {description}
            </p>
          ) : null}
        </div>
      </div>
    </header>
  );
}
