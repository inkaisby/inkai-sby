import { auth } from "@/auth";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Award } from "lucide-react";
import { fetchMyMemberProfile } from "@/lib/inkai-api/member-data";

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
      <h2 className="mb-6 text-2xl font-bold">Prestasi & Sabuk</h2>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-inkai-red" />
            Sabuk Saat Ini
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Badge className="bg-inkai-yellow text-lg text-inkai-black hover:bg-inkai-yellow">
            {String(member.currentRank)}
          </Badge>
        </CardContent>
      </Card>

      <h3 className="mb-3 text-lg font-semibold">Riwayat Sabuk</h3>
      {ranks.length === 0 ? (
        <Card className="mb-8">
          <CardContent className="p-6 text-center text-muted-foreground">
            Belum ada riwayat kenaikan sabuk tercatat.
          </CardContent>
        </Card>
      ) : (
        <div className="mb-8 space-y-2">
          {ranks.map((r) => (
            <Card key={String(r.id)}>
              <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4">
                <div>
                  <p className="font-medium">{String(r.rank)}</p>
                  {r.location != null && r.location !== "" && (
                    <p className="text-sm text-muted-foreground">{String(r.location)}</p>
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <h3 className="mb-3 text-lg font-semibold">Riwayat UKT / Ujian</h3>
      {uktEvents.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            Belum ada riwayat UKT tercatat.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {uktEvents.map((r) => {
            const event = r.event as { title?: string; startDate?: string } | undefined;
            const category = r.category as { name?: string } | null | undefined;
            return (
            <Card key={String(r.id)}>
              <CardContent className="flex justify-between p-4">
                <div>
                  <p className="font-medium">{event?.title ?? "—"}</p>
                  <p className="text-sm text-muted-foreground">
                    {category?.name || String(r.registeredRank ?? "—")} ·{" "}
                    {event?.startDate
                      ? new Date(event.startDate).toLocaleDateString("id-ID")
                      : "—"}
                  </p>
                </div>
                <Badge variant="secondary">{String(r.status)}</Badge>
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
