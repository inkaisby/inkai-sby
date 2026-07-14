import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { canAccessAdmin } from "@/lib/rbac";
import { CarouselManager } from "./CarouselManager";

export const dynamic = "force-dynamic";

export default async function AdminCarouselPage() {
  const session = await auth();
  if (!session || !canAccessAdmin(session.user)) redirect("/login");

  const items = await prisma.newsCarousel.findMany({ orderBy: { order: "asc" } });

  return (
    <>
      <h2 className="mb-6 text-2xl font-bold">Kelola Carousel Beranda</h2>
      <CarouselManager initialItems={items} />
    </>
  );
}
