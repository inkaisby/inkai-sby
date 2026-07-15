"use client";

import { AppSidebar, UserMenu } from "@/components/layout/AppShell";
import { DashboardTopbar } from "@/components/layout/DashboardTopbar";
import { NavigationProvider, useNavigation } from "@/components/layout/NavigationProvider";
import { InkaiLogoLoader } from "@/components/ui/InkaiLogoLoader";

function MainContent({ children }: { children: React.ReactNode }) {
  const { isNavigating } = useNavigation();

  return (
    <main className="relative flex-1 p-4 sm:p-6">
      {isNavigating && (
        <div
          className="absolute inset-0 z-10 flex items-start justify-center bg-background/50 pt-20 backdrop-blur-[2px]"
          aria-live="polite"
          aria-label="Memuat halaman"
        >
          <div className="rounded-2xl border bg-background/90 px-10 py-8 shadow-lg backdrop-blur-sm">
            <InkaiLogoLoader size="md" message="Memuat data..." />
          </div>
        </div>
      )}
      {children}
    </main>
  );
}

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
    <NavigationProvider>
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
          <MainContent>{children}</MainContent>
        </div>
      </div>
    </NavigationProvider>
  );
}
