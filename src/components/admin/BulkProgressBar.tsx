"use client";

/** Progress bar sederhana untuk aksi bulk (hapus/arsip/nonaktif). */
export function BulkProgressBar({
  percent,
  done,
  total,
  label,
}: {
  percent: number;
  done: number;
  total: number;
  label?: string;
}) {
  const safe = Math.max(0, Math.min(100, percent));
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">
          {label || "Memproses…"}
        </span>
        <span className="font-semibold tabular-nums text-foreground">
          {safe}%
          {total > 0 ? (
            <span className="ml-1 font-normal text-muted-foreground">
              ({done}/{total})
            </span>
          ) : null}
        </span>
      </div>
      <div
        className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={safe}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-inkai-red transition-[width] duration-300 ease-out"
          style={{ width: `${safe}%` }}
        />
      </div>
    </div>
  );
}
