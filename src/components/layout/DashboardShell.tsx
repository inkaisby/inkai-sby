"use client";

import { AppSidebar, UserMenu } from "@/components/layout/AppShell";
import { AdminAccessGate } from "@/components/layout/AdminAccessGate";
import { DashboardTopbar } from "@/components/layout/DashboardTopbar";
import { NavigationProvider, useNavigation } from "@/components/layout/NavigationProvider";
import { InkaiLogoLoader } from "@/components/ui/InkaiLogoLoader";
import type { NavItem } from "@/lib/dashboard-nav";
import { useEffect, useState } from "react";

function MainContent({ children }: { children: React.ReactNode }) {
  const { isNavigating } = useNavigation();
  const [overlayVisible, setOverlayVisible] = useState(false);

  useEffect(() => {
    if (isNavigating) {
      setOverlayVisible(true);
      return;
    }

    if (!overlayVisible) return;

    const timer = setTimeout(() => setOverlayVisible(false), 120);
    return () => clearTimeout(timer);
  }, [isNavigating, overlayVisible]);

  return (
    <main className="relative flex-1 p-4 sm:p-6">
      {overlayVisible && (
        <div
          className={`pointer-events-none absolute inset-0 z-10 flex items-start justify-center bg-background/40 pt-20 backdrop-blur-[1px] transition-opacity duration-200 ${
            isNavigating ? "opacity-100" : "opacity-0"
          }`}
          aria-live="polite"
          aria-label="Memuat halaman"
        >
          <div
            className={`rounded-2xl border bg-background/90 px-10 py-8 shadow-lg backdrop-blur-sm transition-transform duration-200 ${
              isNavigating ? "scale-100" : "scale-[0.98]"
            }`}
          >
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
  roles = [],
  children,
}: {
  title: string;
  links: NavItem[];
  userName: string;
  userEmail: string;
  showAdmin?: boolean;
  roles?: string[];
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
          {showAdmin ? (
            <AdminAccessGate roles={roles}>
              <MainContent>{children}</MainContent>
            </AdminAccessGate>
          ) : (
            <MainContent>{children}</MainContent>
          )}
        </div>
      </div>
    </NavigationProvider>
  );
}
