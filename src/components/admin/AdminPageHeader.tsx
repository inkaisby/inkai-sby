import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Judul halaman admin — di HP judul sudah di topbar, jadi H2 disembunyikan
 * agar tidak dobel dan hemat viewport.
 */
export function AdminPageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "admin-page-header mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <div className="hidden items-start gap-3 sm:flex">
          <span
            className="mt-1.5 h-7 w-1 shrink-0 rounded-full bg-gradient-to-b from-inkai-red to-inkai-yellow/80"
            aria-hidden
          />
          <div className="min-w-0">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              {title}
            </h2>
            {description ? (
              <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-[0.95rem]">
                {description}
              </p>
            ) : null}
          </div>
        </div>
        {/* Mobile: deskripsi saja, judul di topbar */}
        {description ? (
          <p className="text-sm leading-relaxed text-muted-foreground sm:hidden">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:items-center [&_*]:min-w-0 [&>a]:inline-flex [&>button]:min-h-10 sm:[&>button]:min-h-8">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
