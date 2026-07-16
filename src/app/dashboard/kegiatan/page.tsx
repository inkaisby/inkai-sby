import { auth } from "@/auth";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ChevronRight } from "lucide-react";
import { fetchMyEventRegistrations } from "@/lib/inkai-api/member-data";
import { MemberPageHeader } from "@/components/member/MemberPageHeader";

export const dynamic = "force-dynamic";

export default async function MemberKegiatanPage() {
  const session = await auth();
  if (!session?.user.memberId) redirect("/login");
  const token = await getInkaiAccessToken();
  if (!token) redirect("/login");

  const registrations = await fetchMyEventRegistrations(token);

  return (
    <>
      <MemberPageHeader
        title="Kegiatan Saya"
        rightSlot={
          <Link
            href="/kegiatan"
            className="text-[10px] font-semibold text-inkai-red"
            aria-label="Lihat semua kegiatan"
          >
            Semua
          </Link>
        }
      />
      {registrations.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Anda belum terdaftar di kegiatan manapun.
        </div>
      ) : (
        <div className="space-y-3">
          {registrations.map((r) => {
            const event = r.event as
              | { id?: string; title?: string; startDate?: string }
              | undefined;
            const category = r.category as { name?: string } | null | undefined;
            return (
              <Link
                key={String(r.id)}
                href={event?.id ? `/kegiatan/${event.id}` : "/kegiatan"}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card p-4 transition-colors hover:bg-muted/40"
              >
                <div className="min-w-0">
                  <p className="font-semibold">{event?.title ?? "—"}</p>
                  <p className="text-sm text-muted-foreground">
                    {event?.startDate
                      ? new Date(event.startDate).toLocaleDateString("id-ID")
                      : "—"}
                    {category && ` · ${category.name}`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="secondary">{String(r.status)}</Badge>
                  <ChevronRight size={16} className="text-muted-foreground" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
