import { Suspense } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { canAccessAdmin } from "@/lib/rbac";
import {
  adminFallbackPath,
  canAccessAdminPath,
} from "@/lib/admin-page-access";
import { fetchCarouselItems } from "@/lib/inkai-api/admin-data";
import { CarouselManager } from "./CarouselManager";
import { AdminPageLoader } from "@/components/ui/AdminPageLoader";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

export const dynamic = "force-dynamic";

export default function AdminCarouselPage() {
  return (
    <Suspense fallback={<AdminPageLoader rows={3} />}>
      <AdminCarouselContent />
    </Suspense>
  );
}

async function AdminCarouselContent() {
  const session = await auth();
  if (!session || !canAccessAdmin(session.user)) redirect("/login");
  if (!canAccessAdminPath(session.user.roles ?? [], "/admin/carousel")) {
    redirect(adminFallbackPath(session.user.roles ?? []));
  }

  const items = await fetchCarouselItems() as Array<{
    id: string;
    title: string;
    imageUrl: string;
    targetUrl: string | null;
    order: number;
    isActive: boolean;
  }>;

  return (
    <>
      <AdminPageHeader title="Kelola Carousel Beranda" />
      <CarouselManager initialItems={items} />
    </>
  );
}
