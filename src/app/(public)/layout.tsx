import PublicHeader from "@/components/layout/PublicHeader";
import PublicFooter from "@/components/layout/PublicFooter";
import { LoginModalProvider } from "@/components/auth/LoginModal";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LoginModalProvider>
      <div className="public-app flex min-h-screen flex-col" data-public="true">
        <PublicHeader />
        <main className="public-surface relative flex-1">
          <div className="public-content-enter relative z-[1]">{children}</div>
        </main>
        <PublicFooter />
      </div>
    </LoginModalProvider>
  );
}
