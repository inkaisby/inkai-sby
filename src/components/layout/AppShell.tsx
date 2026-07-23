"use client";

import { useEffect, useMemo, useState } from "react";
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
import {
  rememberSwitchAccount,
} from "@/lib/switch-accounts-storage";
import { LogOut, Home, User, Bell, ArrowLeftRight, Check } from "lucide-react";

type PeerAccount = {
  email: string;
  fullName: string | null;
  dojoNames: string[];
  isCurrent: boolean;
};

export function UserMenu({
  name,
  email,
  showAdmin = false,
  hasMemberPortal = false,
}: {
  name: string;
  email: string;
  showAdmin?: boolean;
  hasMemberPortal?: boolean;
}) {
  const [switchOpen, setSwitchOpen] = useState(false);
  const [switchPrefill, setSwitchPrefill] = useState("");
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [peers, setPeers] = useState<PeerAccount[]>([]);

  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  useEffect(() => {
    if (email) rememberSwitchAccount(email);
  }, [email]);

  useEffect(() => {
    if (!showAdmin) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/admin/account-peers", {
          cache: "no-store",
        });
        const data = (await res.json().catch(() => ({}))) as {
          peers?: PeerAccount[];
        };
        if (!cancelled && res.ok) {
          setPeers(data.peers ?? []);
        }
      } catch {
        if (!cancelled) setPeers([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showAdmin, email]);

  /** Hanya akun yang berbagi kelola ranting (dari pengaturan), bukan riwayat ganti akun. */
  const linkedEmails = useMemo(() => {
    const current = email.trim().toLowerCase();
    const fromPeers = peers
      .map((p) => p.email.trim().toLowerCase())
      .filter(Boolean);
    if (current && !fromPeers.includes(current)) {
      fromPeers.unshift(current);
    }
    fromPeers.sort((a, b) => {
      if (a === current) return -1;
      if (b === current) return 1;
      return a.localeCompare(b);
    });
    return fromPeers;
  }, [peers, email]);

  const openSwitch = (prefill = "") => {
    setSwitchPrefill(prefill);
    setSwitchOpen(true);
  };

  const otherLinked = linkedEmails.filter(
    (e) => e.toLowerCase() !== email.trim().toLowerCase(),
  );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="h-auto max-w-[min(100vw-8rem,16rem)] gap-2 px-2 py-1.5"
          >
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="bg-inkai-red text-xs text-white">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="hidden min-w-0 flex-col items-start text-left sm:flex">
              <span className="truncate text-xs font-semibold leading-tight">
                {email || name}
              </span>
              {otherLinked.slice(0, 3).map((e) => (
                <span
                  key={e}
                  className="truncate text-[10px] leading-tight text-muted-foreground"
                >
                  {e}
                </span>
              ))}
              {otherLinked.length > 3 ? (
                <span className="text-[10px] text-muted-foreground">
                  +{otherLinked.length - 3} akun lain
                </span>
              ) : null}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <div className="px-2 py-1.5 text-sm">
            <p className="font-medium">{name}</p>
            <p className="text-xs text-muted-foreground">{email}</p>
          </div>

          {linkedEmails.length > 1 && (
            <>
              <DropdownMenuSeparator />
              <div className="px-2 py-1">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Akun gabungan / pindah
                </p>
              </div>
              {linkedEmails.map((e) => {
                const isCurrent =
                  e.toLowerCase() === email.trim().toLowerCase();
                const peer = peers.find(
                  (p) => p.email.toLowerCase() === e.toLowerCase(),
                );
                return (
                  <DropdownMenuItem
                    key={e}
                    disabled={isCurrent}
                    onSelect={() => {
                      if (!isCurrent) openSwitch(e);
                    }}
                    className="flex flex-col items-start gap-0.5 py-2"
                  >
                    <span className="flex w-full items-center gap-2">
                      {isCurrent ? (
                        <Check className="h-3.5 w-3.5 shrink-0 text-inkai-red" />
                      ) : (
                        <ArrowLeftRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      )}
                      <span className="truncate font-mono text-xs">{e}</span>
                    </span>
                    {peer?.dojoNames?.length ? (
                      <span className="pl-5 text-[10px] text-muted-foreground">
                        {peer.dojoNames.join(" · ")}
                      </span>
                    ) : null}
                  </DropdownMenuItem>
                );
              })}
            </>
          )}

          <DropdownMenuSeparator />
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
          {showAdmin && hasMemberPortal && (
            <DropdownMenuItem asChild>
              <Link href="/dashboard">
                <User className="mr-2 h-4 w-4" />
                Dashboard Anggota
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => openSwitch("")}>
            <ArrowLeftRight className="mr-2 h-4 w-4" />
            Ganti Akun lain…
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
        onOpenChange={(open) => {
          setSwitchOpen(open);
          if (!open) setSwitchPrefill("");
        }}
        currentEmail={email}
        initialEmail={switchPrefill}
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
    <aside className="admin-sidebar hidden w-64 flex-shrink-0 border-r border-border/60 bg-gradient-to-b from-muted/40 via-background to-background lg:block">
      <div className="flex h-16 items-center gap-2.5 border-b border-border/60 px-4">
        <Image
          src="/logo-inkai.png"
          alt="INKAI"
          width={36}
          height={36}
          className="rounded-full shadow-sm ring-2 ring-inkai-red/15"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-tight">{title}</p>
          <p className="truncate text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            INKAI Surabaya
          </p>
        </div>
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
