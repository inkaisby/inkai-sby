import { InkaiLogoLoader } from "@/components/ui/InkaiLogoLoader";
import { AdminTableSkeleton } from "@/components/ui/AdminTableSkeleton";

export function AdminPageLoader({
  message = "Memuat data...",
  rows = 6,
}: {
  message?: string;
  rows?: number;
}) {
  return (
    <div className="space-y-10 py-4">
      <InkaiLogoLoader size="md" message={message} />
      <AdminTableSkeleton rows={rows} className="opacity-40" />
    </div>
  );
}
