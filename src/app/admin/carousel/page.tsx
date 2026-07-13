import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { canAccessAdmin } from "@/lib/rbac";
import { AppSidebar, UserMenu } from "@/components/layout/AppShell";
import {
  ADMIN_LINKS,
  MobileDashboardNav,
} from "@/components/layout/MobileDashboardNav";
import { CarouselManager } from "./CarouselManager";

export const dynamic = "force-dynamic";

export default async function AdminCarouselPage() {
  const session = await auth();
  if (!session || !canAccessAdmin(session.user)) redirect("/login");

  const items = await prisma.newsCarousel.findMany({ orderBy: { order: "asc" } });
  const links = ADMIN_LINKS.map((l) => ({
    ...l,
    active: l.href === "/admin/carousel",
  }));

  return (
    <div className="flex min-h-screen">
      <AppSidebar title="Admin Panel" links={links} />
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <MobileDashboardNav title="Admin Panel" links={links} />
            <h1 className="text-lg font-bold hidden sm:block">Carousel Beranda</h1>
          </div>
          <UserMenu name={session.user.name} email={session.user.email} showAdmin />
        </header>
        <main className="flex-1 p-4 sm:p-6">
          <h2 className="mb-6 text-2xl font-bold">Kelola Carousel Beranda</h2>
          <CarouselManager initialItems={items} />
        </main>
      </div>
    </div>
  );
}
