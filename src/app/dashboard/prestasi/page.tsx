import { auth } from "@/auth";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Award } from "lucide-react";
import { fetchMyMemberProfile } from "@/lib/inkai-api/member-data";
import { MemberPageHeader } from "@/components/member/MemberPageHeader";

export const dynamic = "force-dynamic";

export default async function PrestasiPage() {
  const session = await auth();
  if (!session?.user.memberId) redirect("/login");
  const token = await getInkaiAccessToken();
  if (!token) redirect("/login");

  const member = await fetchMyMemberProfile(token);
  if (!member?.id) redirect("/dashboard");

  const ranks = (member.ranks as Array<Record<string, unknown>>) ?? [];
  const eventRegistrations =
    (member.eventRegistrations as Array<Record<string, unknown>>) ?? [];

  const uktEvents = eventRegistrations.filter((r) => {
    const event = r.event as { title?: string } | undefined;
    const title = (event?.title ?? "").toUpperCase();
    return title.includes("UKT") || title.includes("UJIAN");
  });

  return (
    <>
      <MemberPageHeader title="Prestasi & Sabuk" />

      <div className="mb-6 rounded-2xl border border-border/60 bg-card p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <Award className="h-4 w-4 text-inkai-red" />
          Sabuk Saat Ini
        </div>
        <Badge className="bg-inkai-yellow text-base text-inkai-black hover:bg-inkai-yellow">
          {String(member.currentRank)}
        </Badge>
      </div>

      <h3 className="mb-3 text-base font-extrabold">Riwayat Sabuk</h3>
      {ranks.length === 0 ? (
        <div className="mb-8 rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Belum ada riwayat kenaikan sabuk tercatat.
        </div>
      ) : (
        <div className="mb-8 space-y-2">
          {ranks.map((r) => (
            <div
              key={String(r.id)}
              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border/60 bg-card p-4"
            >
              <div>
                <p className="font-semibold">{String(r.rank)}</p>
                {r.location != null && r.location !== "" && (
                  <p className="text-sm text-muted-foreground">
                    {String(r.location)}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm">
                  {new Date(String(r.date)).toLocaleDateString("id-ID")}
                </p>
                {r.isVerified === true && (
                  <Badge variant="outline" className="mt-1">
                    Terverifikasi
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <h3 className="mb-3 text-base font-extrabold">Riwayat UKT / Ujian</h3>
      {uktEvents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Belum ada riwayat UKT tercatat.
        </div>
      ) : (
        <div className="space-y-2">
          {uktEvents.map((r) => {
            const event = r.event as
              | { title?: string; startDate?: string }
              | undefined;
            const category = r.category as { name?: string } | null | undefined;
            return (
              <div
                key={String(r.id)}
                className="flex justify-between gap-3 rounded-2xl border border-border/60 bg-card p-4"
              >
                <div className="min-w-0">
                  <p className="font-semibold">{event?.title ?? "—"}</p>
                  <p className="text-sm text-muted-foreground">
                    {category?.name || String(r.registeredRank ?? "—")} ·{" "}
                    {event?.startDate
                      ? new Date(event.startDate).toLocaleDateString("id-ID")
                      : "—"}
                  </p>
                </div>
                <Badge variant="secondary" className="shrink-0">
                  {String(r.status)}
                </Badge>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
