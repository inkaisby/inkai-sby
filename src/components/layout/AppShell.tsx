"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { SidebarNavLink } from "@/components/layout/SidebarNavLink";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SwitchAccountModal } from "@/components/auth/SwitchAccountModal";
import { LogOut, Home, User, Bell, ArrowLeftRight } from "lucide-react";

export function UserMenu({
  name,
  email,
  showAdmin = false,
}: {
  name: string;
  email: string;
  showAdmin?: boolean;
}) {
  const [switchOpen, setSwitchOpen] = useState(false);

  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="gap-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-inkai-red text-white text-xs">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="hidden sm:inline text-sm">{name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <div className="px-2 py-1.5 text-sm">
          <p className="font-medium">{name}</p>
          <p className="text-xs text-muted-foreground">{email}</p>
        </div>
        <DropdownMenuItem asChild>
          <Link href={showAdmin ? "/admin/notifikasi" : "/dashboard/notifikasi"}>
            <Bell className="mr-2 h-4 w-4" />
            Notifikasi
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/">
            <Home className="mr-2 h-4 w-4" />
            Beranda Publik
          </Link>
        </DropdownMenuItem>
        {!showAdmin && (
          <DropdownMenuItem asChild>
            <Link href="/dashboard">
              <User className="mr-2 h-4 w-4" />
              Dashboard Anggota
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => setSwitchOpen(true)}>
          <ArrowLeftRight className="mr-2 h-4 w-4" />
          Ganti Akun
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => signOut({ callbackUrl: "/" })}
          className="text-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Keluar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>

    <SwitchAccountModal
      open={switchOpen}
      onOpenChange={setSwitchOpen}
      currentEmail={email}
    />
    </>
  );
}

export function AppSidebar({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string; active?: boolean }[];
}) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 flex-shrink-0 border-r bg-muted/30 lg:block">
      <div className="flex h-16 items-center gap-2 border-b px-4">
        <Image
          src="/logo-inkai.png"
          alt="INKAI"
          width={36}
          height={36}
          className="rounded-full"
        />
        <p className="text-sm font-bold">{title}</p>
      </div>
      <nav className="p-3">
        {links.map((link) => {
          const isActive =
            link.active ??
            (pathname === link.href ||
              (link.href !== "/dashboard" &&
                link.href !== "/admin" &&
                pathname.startsWith(link.href)));
          return (
            <SidebarNavLink
              key={link.href}
              href={link.href}
              label={link.label}
              isActive={isActive}
            />
          );
        })}
      </nav>
    </aside>
  );
}
