"use client";

import { AppSidebar, UserMenu } from "@/components/layout/AppShell";
import { DashboardTopbar } from "@/components/layout/DashboardTopbar";

export function DashboardShell({
  title,
  links,
  userName,
  userEmail,
  showAdmin = false,
  children,
}: {
  title: string;
  links: { href: string; label: string }[];
  userName: string;
  userEmail: string;
  showAdmin?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <AppSidebar title={title} links={links} />
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardTopbar
          title={title}
          links={links}
          userName={userName}
          userEmail={userEmail}
          showAdmin={showAdmin}
        />
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
