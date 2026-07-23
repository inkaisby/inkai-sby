import Image from "next/image";
import Link from "next/link";

type AuthShellProps = {
  children: React.ReactNode;
  title: string;
  subtitle: string;
};

export default function AuthShell({ children, title, subtitle }: AuthShellProps) {
  return (
    <div className="inkai-hero relative min-h-[calc(100vh-4rem)] overflow-hidden">
      <div className="inkai-hero-grid absolute inset-0 opacity-40" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-background" />

      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-lg flex-col justify-center px-4 py-12 sm:px-6">
        <div className="mb-6 text-center">
          <Link href="/" className="inline-flex flex-col items-center gap-3">
            <Image
              src="/logo-inkai.png"
              alt="Logo INKAI"
              width={72}
              height={72}
              className="rounded-full ring-2 ring-white/20 shadow-lg"
              priority
            />
            <div>
              <h1 className="text-xl font-bold text-white">{title}</h1>
              <p className="mt-1 text-sm text-white/70">{subtitle}</p>
            </div>
          </Link>
        </div>

        <div className="rounded-2xl border border-white/15 bg-background/95 p-6 shadow-2xl shadow-black/30 backdrop-blur-md sm:p-8">
          {children}
        </div>

        <p className="mt-6 text-center text-xs text-white/50">
          Data akun tersimpan aman di Supabase PostgreSQL
        </p>
      </div>
    </div>
  );
}
