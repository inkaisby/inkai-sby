"use client";

import Link from "next/link";
import {
  QrCode,
  Wallet,
  Award,
  FileText,
  CalendarCheck,
  BookOpen,
  ShoppingBag,
  Scroll,
  GraduationCap,
  ArrowRightLeft,
  History,
} from "lucide-react";

const ACTIONS = [
  { icon: QrCode, label: "Absensi", href: "/dashboard/absensi" },
  { icon: Wallet, label: "Iuran", href: "/dashboard/iuran" },
  { icon: BookOpen, label: "Materi", href: "/dashboard/materi" },
  { icon: ShoppingBag, label: "Store", href: "/dashboard/store" },
  { icon: Award, label: "Sabuk", href: "/dashboard/prestasi?tab=Sabuk" },
  { icon: Scroll, label: "Piagam", href: "/dashboard/prestasi?tab=Piagam" },
  {
    icon: GraduationCap,
    label: "Pelatihan",
    href: "/dashboard/prestasi?tab=Pelatihan",
  },
  { icon: ArrowRightLeft, label: "Pindah", href: "/dashboard/pindah" },
  { icon: FileText, label: "Dokumen", href: "/dashboard/dokumen" },
  { icon: CalendarCheck, label: "Event", href: "/dashboard/kegiatan" },
  { icon: History, label: "Riwayat", href: "/dashboard/riwayat" },
] as const;

export function QuickActions() {
  return (
    <div className="grid grid-cols-4 gap-x-3 gap-y-6">
      {ACTIONS.map((action, i) => {
        const Icon = action.icon;
        return (
          <Link
            key={`${action.href}-${action.label}`}
            href={action.href}
            className="member-stagger flex flex-col items-center gap-2 transition-transform active:scale-95"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="flex h-[60px] w-[60px] items-center justify-center rounded-[20px] border border-border/80 bg-muted/60 text-inkai-red dark:bg-white/5">
              <Icon size={22} />
            </div>
            <span className="text-center text-[11px] font-semibold text-muted-foreground">
              {action.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
