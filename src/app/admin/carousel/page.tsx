import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { canAccessAdmin } from "@/lib/rbac";
import { fetchCarouselItems } from "@/lib/inkai-api/admin-data";
import { CarouselManager } from "./CarouselManager";

export const dynamic = "force-dynamic";

export default async function AdminCarouselPage() {
  const session = await auth();
  if (!session || !canAccessAdmin(session.user)) redirect("/login");

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
      <h2 className="mb-6 text-2xl font-bold">Kelola Carousel Beranda</h2>
      <CarouselManager initialItems={items} />
    </>
  );
}
