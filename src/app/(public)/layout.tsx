import PublicHeader from "@/components/layout/PublicHeader";
import PublicFooter from "@/components/layout/PublicFooter";
import NavigationProgress from "@/components/layout/NavigationProgress";
import { LoginModalProvider } from "@/components/auth/LoginModal";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LoginModalProvider>
      <div className="flex min-h-screen flex-col">
        <NavigationProgress />
        <PublicHeader />
        <main className="flex-1">{children}</main>
        <PublicFooter />
      </div>
    </LoginModalProvider>
  );
}
