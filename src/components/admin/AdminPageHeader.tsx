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
        "mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="hidden text-2xl font-bold sm:block">{title}</h2>
        {description ? (
          <p
            className={cn(
              "text-sm leading-relaxed text-muted-foreground",
              "sm:mt-1 sm:text-base",
            )}
          >
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
