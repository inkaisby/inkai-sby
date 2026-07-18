"use client";

import Link from "next/link";
import {
  QrCode,
  Wallet,
  Award,
  FileText,
  CalendarCheck,
  MessageCircle,
  BookOpen,
  MoreHorizontal,
  ShoppingBag,
  Scroll,
  GraduationCap,
  ArrowRightLeft,
  History,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type Action = {
  icon: typeof QrCode;
  label: string;
  href: string;
  badge?: string | number | null;
  emphasize?: boolean;
};

const MORE_LINKS = [
  { icon: ShoppingBag, label: "Store", href: "/dashboard/store" },
  { icon: Scroll, label: "Piagam", href: "/dashboard/prestasi?tab=Piagam" },
  {
    icon: GraduationCap,
    label: "Pelatihan",
    href: "/dashboard/prestasi?tab=Pelatihan",
  },
  { icon: ArrowRightLeft, label: "Pindah Dojo", href: "/dashboard/pindah" },
  { icon: FileText, label: "Dokumen", href: "/dashboard/dokumen" },
  { icon: History, label: "Riwayat", href: "/dashboard/riwayat" },
  { icon: BookOpen, label: "Materi", href: "/dashboard/materi" },
] as const;

export function QuickActions({
  checkedInToday = false,
  unpaidIuran = 0,
  documentsIncomplete = false,
  unreadPesan = 0,
}: {
  checkedInToday?: boolean;
  unpaidIuran?: number;
  documentsIncomplete?: boolean;
  unreadPesan?: number;
}) {
  const actions: Action[] = [
    {
      icon: QrCode,
      label: "Absensi",
      href: "/dashboard/absensi",
      emphasize: !checkedInToday,
      badge: checkedInToday ? "✓" : null,
    },
    {
      icon: Wallet,
      label: "Iuran",
      href: "/dashboard/iuran",
      badge: unpaidIuran > 0 ? unpaidIuran : null,
      emphasize: unpaidIuran > 0,
    },
    {
      icon: CalendarCheck,
      label: "Event",
      href: "/dashboard/kegiatan",
    },
    {
      icon: MessageCircle,
      label: "Pesan",
      href: "/dashboard/pesan",
      badge: unreadPesan > 0 ? unreadPesan : null,
      emphasize: unreadPesan > 0,
    },
    {
      icon: Award,
      label: "Sabuk",
      href: "/dashboard/prestasi?tab=Sabuk",
    },
    documentsIncomplete
      ? {
          icon: FileText,
          label: "Dokumen",
          href: "/dashboard/dokumen",
          emphasize: true,
        }
      : {
          icon: BookOpen,
          label: "Materi",
          href: "/dashboard/materi",
        },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-extrabold">Aksi Cepat</h2>
        <Sheet>
          <SheetTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs font-semibold text-inkai-red"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
              Lainnya
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl">
            <SheetHeader>
              <SheetTitle>Menu lainnya</SheetTitle>
            </SheetHeader>
            <div className="mt-4 grid grid-cols-3 gap-3 pb-6">
              {MORE_LINKS.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href + item.label}
                    href={item.href}
                    className="flex flex-col items-center gap-2 rounded-xl border p-3 text-center"
                  >
                    <Icon className="h-5 w-5 text-inkai-red" />
                    <span className="text-[11px] font-semibold">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </SheetContent>
        </Sheet>
      </div>
      <div className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-6">
        {actions.map((action, i) => {
          const Icon = action.icon;
          const badge =
            action.badge == null
              ? null
              : typeof action.badge === "number" && action.badge > 9
                ? "9+"
                : String(action.badge);
          return (
            <Link
              key={`${action.href}-${action.label}`}
              href={action.href}
              className="member-stagger relative flex flex-col items-center gap-2 transition-transform active:scale-95"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div
                className={cn(
                  "relative flex h-[56px] w-[56px] items-center justify-center rounded-[18px] border text-inkai-red",
                  action.emphasize
                    ? "border-inkai-red/40 bg-inkai-red/10"
                    : "border-border/80 bg-muted/60 dark:bg-white/5",
                )}
              >
                <Icon size={22} />
                {badge ? (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-inkai-red px-1 text-[9px] font-bold text-white">
                    {badge}
                  </span>
                ) : null}
              </div>
              <span className="text-center text-[11px] font-semibold text-muted-foreground">
                {action.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
