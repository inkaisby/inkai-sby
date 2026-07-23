"use client";

import { AppSidebar } from "@/components/layout/AppShell";
import { AdminAccessGate } from "@/components/layout/AdminAccessGate";
import { DashboardTopbar } from "@/components/layout/DashboardTopbar";
import type { NavItem } from "@/lib/dashboard-nav";
import type { AdminDojoGrants } from "@/lib/admin-dojo-grants";

function MainContent({
  children,
  showAdmin,
}: {
  children: React.ReactNode;
  showAdmin?: boolean;
}) {
  return (
    <main
      data-admin-shell={showAdmin ? "true" : undefined}
      className={`relative min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-3 sm:p-6 ${
        showAdmin ? "admin-surface" : ""
      }`}
    >
      {children}
    </main>
  );
}

export function DashboardShell({
  title,
  links,
  userName,
  userEmail,
  userPhotoUrl = null,
  showAdmin = false,
  hasMemberPortal = false,
  roles = [],
  adminDojoGrants = null,
  children,
}: {
  title: string;
  links: NavItem[];
  userName: string;
  userEmail: string;
  userPhotoUrl?: string | null;
  showAdmin?: boolean;
  hasMemberPortal?: boolean;
  roles?: string[];
  adminDojoGrants?: AdminDojoGrants | null;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex h-svh overflow-hidden ${showAdmin ? "admin-app" : ""}`}
      data-admin={showAdmin ? "true" : undefined}
    >
      <AppSidebar title={title} links={links} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <DashboardTopbar
          title={title}
          links={links}
          userName={userName}
          userEmail={userEmail}
          userPhotoUrl={userPhotoUrl}
          showAdmin={showAdmin}
          hasMemberPortal={hasMemberPortal}
        />
        {showAdmin ? (
          <AdminAccessGate roles={roles} adminDojoGrants={adminDojoGrants}>
            <MainContent showAdmin>{children}</MainContent>
          </AdminAccessGate>
        ) : (
          <MainContent>{children}</MainContent>
        )}
      </div>
    </div>
  );
}
