import { AdminPageLoader } from "@/components/ui/AdminPageLoader";

export default function DashboardLoading() {
  return (
    <div className="p-1">
      <AdminPageLoader message="Memuat dashboard anggota..." rows={4} />
    </div>
  );
}
