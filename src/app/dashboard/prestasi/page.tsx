import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Award } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PrestasiPage() {
  const session = await auth();
  if (!session?.user.memberId) redirect("/login");

  const member = await prisma.member.findFirst({
    where: { id: session.user.memberId, isDeleted: false },
    include: {
      ranks: { orderBy: { date: "desc" } },
      eventRegistrations: {
        where: { status: { in: ["PAID", "APPROVED", "SUCCESS"] } },
        include: { event: true, category: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!member) redirect("/dashboard");

  const uktEvents = member.eventRegistrations.filter((r) => {
    const title = r.event.title.toUpperCase();
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
            {member.currentRank}
          </Badge>
        </CardContent>
      </Card>

      <h3 className="mb-3 text-lg font-semibold">Riwayat Sabuk</h3>
      {member.ranks.length === 0 ? (
        <Card className="mb-8">
          <CardContent className="p-6 text-center text-muted-foreground">
            Belum ada riwayat kenaikan sabuk tercatat.
          </CardContent>
        </Card>
      ) : (
        <div className="mb-8 space-y-2">
          {member.ranks.map((r) => (
            <Card key={r.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4">
                <div>
                  <p className="font-medium">{r.rank}</p>
                  {r.location && (
                    <p className="text-sm text-muted-foreground">{r.location}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm">
                    {new Date(r.date).toLocaleDateString("id-ID")}
                  </p>
                  {r.isVerified && (
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
          {uktEvents.map((r) => (
            <Card key={r.id}>
              <CardContent className="flex justify-between p-4">
                <div>
                  <p className="font-medium">{r.event.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {r.category?.name || r.registeredRank || "—"} ·{" "}
                    {new Date(r.event.startDate).toLocaleDateString("id-ID")}
                  </p>
                </div>
                <Badge variant="secondary">{r.status}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
