"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, LogOut, MessageCircle, ScrollText } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogoutConfirmDialog } from "@/components/auth/LogoutConfirmDialog";
import { ThemeIconButton } from "@/components/member/ThemeIconButton";
import { MemberAdminPortalIconButton } from "@/components/member/MemberAdminPortalIconButton";

export function DashboardHomeHeader({
  name,
  roleLabel = "Anggota Aktif",
  photoUrl,
  unreadCount = 0,
  unreadPesan = 0,
}: {
  name: string;
  roleLabel?: string;
  photoUrl?: string | null;
  unreadCount?: number;
  unreadPesan?: number;
}) {
  const [logoutOpen, setLogoutOpen] = useState(false);

  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const firstName = name.split(" ")[0] || name;
  const notifBadge =
    unreadCount > 9 ? "9+" : unreadCount > 0 ? String(unreadCount) : null;
  const pesanBadge =
    unreadPesan > 9 ? "9+" : unreadPesan > 0 ? String(unreadPesan) : null;

  return (
    <>
    <header className="sticky top-0 z-40 -mx-1 flex items-center justify-between gap-3 border-b border-border/40 bg-background/95 px-1 pt-4 pb-2 backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar className="h-10 w-10 ring-2 ring-inkai-red ring-offset-2 ring-offset-background">
          {photoUrl ? <AvatarImage src={photoUrl} alt={name} /> : null}
          <AvatarFallback className="bg-inkai-red text-xs font-bold text-white">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-lg font-extrabold leading-tight">
            Oss, {firstName}!
          </p>
          <p className="text-[11px] font-medium text-inkai-red">{roleLabel}</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <Link
          href="/dashboard/panduan"
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/80 text-foreground transition-colors hover:bg-muted"
          aria-label="Panduan"
        >
          <ScrollText size={18} />
        </Link>
        <Link
          href="/dashboard/pesan"
          className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-muted/80 text-foreground transition-colors hover:bg-muted"
          aria-label="Pesan"
        >
          <MessageCircle size={18} />
          {pesanBadge ? (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-inkai-red px-1 text-[10px] font-bold text-white ring-2 ring-background">
              {pesanBadge}
            </span>
          ) : null}
        </Link>
        <ThemeIconButton />
        <Link
          href="/dashboard/notifikasi"
          className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-muted/80 text-foreground transition-colors hover:bg-muted"
          aria-label="Notifikasi"
        >
          <Bell size={18} />
          {notifBadge ? (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-inkai-red px-1 text-[10px] font-bold text-white ring-2 ring-background">
              {notifBadge}
            </span>
          ) : null}
        </Link>
        <MemberAdminPortalIconButton />
        <button
          type="button"
          onClick={() => setLogoutOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 text-red-500 transition-colors hover:bg-red-500/15"
          aria-label="Keluar"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
    <LogoutConfirmDialog open={logoutOpen} onOpenChange={setLogoutOpen} />
    </>
  );
}
