"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { Bell, LogOut } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function DashboardHomeHeader({
  name,
  roleLabel = "Anggota Aktif",
  photoUrl,
  unreadCount = 0,
}: {
  name: string;
  roleLabel?: string;
  photoUrl?: string | null;
  unreadCount?: number;
}) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const firstName = name.split(" ")[0] || name;
  const badge =
    unreadCount > 9 ? "9+" : unreadCount > 0 ? String(unreadCount) : null;

  return (
    <header className="flex items-center justify-between gap-3 pt-4 pb-1">
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

      <div className="flex shrink-0 items-center gap-2">
        <Link
          href="/dashboard/notifikasi"
          className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-muted/80 text-foreground transition-colors hover:bg-muted"
          aria-label="Notifikasi"
        >
          <Bell size={18} />
          {badge ? (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-inkai-red px-1 text-[10px] font-bold text-white ring-2 ring-background">
              {badge}
            </span>
          ) : null}
        </Link>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 text-red-500 transition-colors hover:bg-red-500/15"
          aria-label="Keluar"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}
