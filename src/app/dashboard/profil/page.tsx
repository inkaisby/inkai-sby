import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AppSidebar, UserMenu } from "@/components/layout/AppShell";
import {
  MEMBER_LINKS,
  MobileDashboardNav,
} from "@/components/layout/MobileDashboardNav";
import ProfilPageClient from "./ProfilPageClient";

export const dynamic = "force-dynamic";

export default async function ProfilPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const member = session.user.memberId
    ? await prisma.member.findFirst({
        where: { id: session.user.memberId, isDeleted: false },
        include: { user: { select: { phoneNumber: true } } },
      })
    : null;

  if (!member) redirect("/dashboard");

  const links = MEMBER_LINKS.map((l) => ({
    ...l,
    active: l.href === "/dashboard/profil",
  }));

  return (
    <div className="flex min-h-screen">
      <AppSidebar title="Dashboard Anggota" links={links} />
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b px-4 sm:px-6">
          <MobileDashboardNav title="Dashboard Anggota" links={links} />
          <UserMenu name={session.user.name} email={session.user.email} />
        </header>
        <main className="flex-1 p-4 sm:p-6">
          <ProfilPageClient
            member={{
              ...member,
              phoneNumber: member.user?.phoneNumber,
            }}
          />
        </main>
      </div>
    </div>
  );
}
