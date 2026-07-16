import { auth } from "@/auth";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ChevronRight } from "lucide-react";
import { fetchMyEventRegistrations } from "@/lib/inkai-api/member-data";
import { MemberPageHeader } from "@/components/member/MemberPageHeader";

export const dynamic = "force-dynamic";

export default async function RiwayatPage() {
  const session = await auth();
  if (!session?.user.memberId) redirect("/login");
  const token = await getInkaiAccessToken();
  if (!token) redirect("/login");

  const registrations = await fetchMyEventRegistrations(token);
  const now = Date.now();

  const past = registrations.filter((r) => {
    const event = r.event as
      | { startDate?: string; endDate?: string }
      | undefined;
    if (!event) return false;
    const end = event.endDate
      ? new Date(event.endDate).getTime()
      : event.startDate
        ? new Date(event.startDate).getTime()
        : 0;
    return end < now;
  });

  return (
    <>
      <MemberPageHeader title="Riwayat Kegiatan" />
      {past.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Belum ada riwayat kegiatan.
        </div>
      ) : (
        <div className="space-y-3">
          {past.map((r) => {
            const event = r.event as
              | { id?: string; title?: string; startDate?: string }
              | undefined;
            return (
              <Link
                key={String(r.id)}
                href={
                  event?.id
                    ? `/dashboard/kegiatan/${event.id}`
                    : "/dashboard/kegiatan"
                }
                className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card p-4 transition-colors hover:bg-muted/40"
              >
                <div className="min-w-0">
                  <p className="font-semibold">{event?.title ?? "—"}</p>
                  <p className="text-sm text-muted-foreground">
                    {event?.startDate
                      ? new Date(event.startDate).toLocaleDateString("id-ID")
                      : "—"}
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
