import { InkaiLogoLoader } from "@/components/ui/InkaiLogoLoader";

export default function DashboardLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center pt-10">
      <InkaiLogoLoader size="md" message="Memuat..." />
    </div>
  );
}
