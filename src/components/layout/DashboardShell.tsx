import { AppSidebar, UserMenu } from "@/components/layout/AppShell";
import { MobileDashboardNav } from "@/components/layout/MobileDashboardNav";

export function DashboardShell({
  title,
  pageTitle,
  links,
  userName,
  userEmail,
  showAdmin = false,
  children,
}: {
  title: string;
  pageTitle?: string;
  links: { href: string; label: string }[];
  userName: string;
  userEmail: string;
  showAdmin?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <AppSidebar title={title} links={links} />
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <MobileDashboardNav title={title} links={links} />
            {pageTitle ? (
              <h1 className="hidden text-lg font-bold sm:block">{pageTitle}</h1>
            ) : null}
          </div>
          <UserMenu name={userName} email={userEmail} showAdmin={showAdmin} />
        </header>
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
