import { AdminTableSkeleton } from "@/components/ui/AdminTableSkeleton";

/** Loading ringan — hindari flash logo penuh saat ganti filter/KPI. */
export default function AnggotaLoading() {
  return (
    <div className="space-y-4 py-2">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="h-[72px] animate-pulse rounded-xl border bg-muted/40"
          />
        ))}
      </div>
      <AdminTableSkeleton rows={6} className="opacity-50" />
    </div>
  );
}
