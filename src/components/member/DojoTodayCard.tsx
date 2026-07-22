import Link from "next/link";
import { CalendarClock, MapPin, MessageCircle, Phone, QrCode } from "lucide-react";
import { SITE_CONTACT } from "@/lib/site";
import { primaryPhoneDigits, toWhatsAppLink } from "@/lib/phone";
import { cn } from "@/lib/utils";

export function DojoTodayCard({
  dojoName,
  schedule,
  tempatLatihan,
  picName,
  phoneNumber,
  checkedInToday,
  isActive,
}: {
  dojoName: string;
  schedule?: string | null;
  tempatLatihan?: string | null;
  picName?: string | null;
  phoneNumber?: string | null;
  checkedInToday: boolean;
  isActive: boolean;
}) {
  const wa = toWhatsAppLink(phoneNumber, SITE_CONTACT.whatsapp);
  const hasPhone = Boolean(primaryPhoneDigits(phoneNumber));

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-extrabold">Dojo & Latihan</h2>
      <div className="rounded-2xl border border-border/80 bg-card p-4">
        <p className="text-sm font-extrabold">{dojoName}</p>

        {schedule ? (
          <p className="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
            <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-inkai-red" />
            <span>{schedule}</span>
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Jadwal latihan belum diatur. Tanya pengurus ranting.
          </p>
        )}

        {tempatLatihan ? (
          <p className="mt-1.5 flex items-start gap-2 text-sm text-muted-foreground">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-inkai-red" />
            <span>{tempatLatihan}</span>
          </p>
        ) : null}

        {(picName || hasPhone) && (
          <div className="mt-3 rounded-xl bg-muted/50 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              PIC Ranting
            </p>
            <p className="text-sm font-semibold">{picName || "Pengurus ranting"}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border bg-background px-2.5 text-xs font-semibold"
              >
                <Phone className="h-3.5 w-3.5 text-inkai-red" />
                WhatsApp
              </a>
              <Link
                href="/dashboard/pesan"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border bg-background px-2.5 text-xs font-semibold"
              >
                <MessageCircle className="h-3.5 w-3.5 text-inkai-red" />
                Pesan app
              </Link>
            </div>
          </div>
        )}

        {isActive ? (
          <Link
            href="/dashboard/absensi"
            className={cn(
              "mt-3 flex items-center justify-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold",
              checkedInToday
                ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                : "bg-inkai-red text-white",
            )}
          >
            <QrCode className="h-4 w-4" />
            {checkedInToday ? "Sudah absen hari ini ✓" : "Absen hari ini"}
          </Link>
        ) : null}
      </div>
    </section>
  );
}
