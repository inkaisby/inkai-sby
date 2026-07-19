"use client";

import { useState } from "react";
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
import { LogoutConfirmDialog } from "@/components/auth/LogoutConfirmDialog";
import { SwitchAccountModal } from "@/components/auth/SwitchAccountModal";
import { SidebarNavGroup } from "@/components/layout/SidebarNavGroup";
import { isNavGroup, type NavItem } from "@/lib/dashboard-nav";
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
  const [logoutOpen, setLogoutOpen] = useState(false);

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
          onSelect={() => setLogoutOpen(true)}
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
    <LogoutConfirmDialog open={logoutOpen} onOpenChange={setLogoutOpen} />
    </>
  );
}

export function AppSidebar({
  title,
  links,
}: {
  title: string;
  links: NavItem[];
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
        {links.map((item) => {
          if (isNavGroup(item)) {
            return (
              <SidebarNavGroup
                key={item.label}
                label={item.label}
                items={item.children}
              />
            );
          }
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" &&
              item.href !== "/admin" &&
              pathname.startsWith(item.href));
            return (
              <SidebarNavLink
                key={item.href}
                href={item.href}
                label={item.label}
                isActive={isActive}
                badge={item.badge}
              />
            );
        })}
      </nav>
    </aside>
  );
}
