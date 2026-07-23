import Link from "next/link";
import {
  CheckCircle2,
  Circle,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ChecklistItem = {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
  href: string;
  cta: string;
};

export function MembershipChecklist({
  items,
  readyLabel = "Kelengkapan keanggotaan sudah baik",
}: {
  items: ChecklistItem[];
  readyLabel?: string;
}) {
  const firstGap = items.find((i) => !i.ok);
  const allOk = !firstGap;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-extrabold">Status Keanggotaan</h2>
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
            allOk
              ? "bg-emerald-500/15 text-emerald-600"
              : "bg-amber-500/15 text-amber-700",
          )}
        >
          {allOk ? "Siap" : "Perlu tindakan"}
        </span>
      </div>

      <div className="rounded-2xl border border-border/80 bg-card p-3.5">
        <ul className="space-y-2.5">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-2.5">
              {item.ok ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              ) : (
                <Circle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-tight">{item.label}</p>
                <p className="text-[11px] text-muted-foreground">{item.detail}</p>
              </div>
            </li>
          ))}
        </ul>

        {firstGap ? (
          <Link
            href={firstGap.href}
            className="mt-3.5 flex items-center justify-between gap-2 rounded-xl bg-inkai-red px-3.5 py-2.5 text-sm font-semibold text-white"
          >
            <span>{firstGap.cta}</span>
            <ChevronRight className="h-4 w-4 shrink-0 opacity-90" />
          </Link>
        ) : (
          <p className="mt-3.5 rounded-xl bg-emerald-500/10 px-3.5 py-2.5 text-sm font-medium text-emerald-700 dark:text-emerald-400">
            {readyLabel}
          </p>
        )}
      </div>
    </section>
  );
}

export function buildMembershipChecklist(opts: {
  profileOk: boolean;
  documentsOk: boolean;
  iuranOk: boolean;
  attendancePct: number;
  attendanceEligible: boolean;
  unpaidCount: number;
}): ChecklistItem[] {
  return [
    {
      id: "profil",
      label: "Profil",
      ok: opts.profileOk,
      detail: opts.profileOk ? "Data diri lengkap" : "Lengkapi data pribadi & foto",
      href: "/dashboard/profil",
      cta: "Lengkapi profil",
    },
    {
      id: "dokumen",
      label: "Dokumen",
      ok: opts.documentsOk,
      detail: opts.documentsOk
        ? "Akte & BPJS sudah ada"
        : "Akte kelahiran / BPJS belum lengkap",
      href: "/dashboard/profil",
      cta: "Lengkapi dokumen",
    },
    {
      id: "iuran",
      label: "Iuran",
      ok: opts.iuranOk,
      detail: opts.iuranOk
        ? "Tidak ada tagihan menunggak"
        : `${opts.unpaidCount} tagihan belum lunas`,
      href: "/dashboard/iuran",
      cta: "Bayar / unggah bukti iuran",
    },
    {
      id: "absensi",
      label: "Kehadiran semester",
      ok: opts.attendanceEligible,
      detail: opts.attendanceEligible
        ? `${opts.attendancePct}% — layak ujian (≥75%)`
        : `${opts.attendancePct}% — target minimal 75%`,
      href: "/dashboard/absensi",
      cta: "Lihat absensi & check-in",
    },
  ];
}
