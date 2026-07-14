"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { canAccessAdmin } from "@/lib/rbac";
import { useLoginModal } from "@/components/auth/LoginModal";

type GuestAuthProps = {
  onLoginClick?: () => void;
};

function AuthLoadingDesktop() {
  return (
    <div
      className="hidden h-8 w-24 animate-pulse rounded-lg bg-muted/70 md:block"
      aria-hidden
    />
  );
}

function AuthLoadingMobile() {
  return (
    <span
      className="block h-9 w-20 animate-pulse rounded-lg bg-muted/70"
      aria-hidden
    />
  );
}

function GuestAuthDesktop({ onLoginClick }: GuestAuthProps) {
  const { openLogin } = useLoginModal();

  return (
    <div className="hidden items-center gap-2 md:flex">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="rounded-lg font-medium"
        onClick={() => {
          onLoginClick?.();
          openLogin();
        }}
      >
        Login
      </Button>
      <Button
        asChild
        size="sm"
        className="rounded-lg bg-inkai-red font-medium text-white shadow-sm shadow-inkai-red/20 hover:bg-inkai-red/90"
      >
        <Link href="/daftar" prefetch>
          Daftar
        </Link>
      </Button>
    </div>
  );
}

function GuestAuthMobile({ onLoginClick }: GuestAuthProps) {
  const { openLogin } = useLoginModal();

  return (
    <>
      <button
        type="button"
        onClick={() => {
          onLoginClick?.();
          openLogin();
        }}
        className="rounded-lg px-3 py-2 text-left text-sm font-medium hover:bg-muted"
      >
        Login
      </button>
      <Link
        href="/daftar"
        prefetch
        className="rounded-lg bg-inkai-red px-3 py-2 text-sm font-medium text-white"
      >
        Daftar
      </Link>
    </>
  );
}

function AuthenticatedAuthDesktop({ session }: { session: NonNullable<ReturnType<typeof useSession>["data"]> }) {
  const href = canAccessAdmin(session.user) ? "/admin" : "/dashboard";
  const label = canAccessAdmin(session.user) ? "Admin" : "Dashboard";

  return (
    <Button asChild variant="outline" size="sm" className="hidden rounded-lg md:inline-flex">
      <Link href={href} prefetch>
        {label}
      </Link>
    </Button>
  );
}

function AuthenticatedAuthMobile({ session }: { session: NonNullable<ReturnType<typeof useSession>["data"]> }) {
  const href = canAccessAdmin(session.user) ? "/admin" : "/dashboard";
  const label = canAccessAdmin(session.user) ? "Admin" : "Dashboard";

  return (
    <Link
      href={href}
      prefetch
      className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted"
    >
      {label}
    </Link>
  );
}

export function PublicHeaderAuthDesktop() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <AuthLoadingDesktop />;
  }

  if (status === "authenticated" && session?.user) {
    return <AuthenticatedAuthDesktop session={session} />;
  }

  return <GuestAuthDesktop />;
}

export function PublicHeaderAuthMobile({ onLoginClick }: GuestAuthProps) {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <AuthLoadingMobile />;
  }

  if (status === "authenticated" && session?.user) {
    return <AuthenticatedAuthMobile session={session} />;
  }

  return <GuestAuthMobile onLoginClick={onLoginClick} />;
}
