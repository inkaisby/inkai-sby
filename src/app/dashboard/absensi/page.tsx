import { auth } from "@/auth";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { fetchMyAttendance } from "@/lib/inkai-api/member-data";

export const dynamic = "force-dynamic";

export default async function AbsensiPage() {
  const session = await auth();
  if (!session?.user.memberId) redirect("/login");
  const token = await getInkaiAccessToken();
  if (!token) redirect("/login");

  const attendances = await fetchMyAttendance(token, 50);

  return (
    <>
      <h2 className="mb-6 text-2xl font-bold">Riwayat Absensi</h2>
      {attendances.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Belum ada riwayat absensi.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {attendances.map((a) => {
            const dojo = a.dojo as { name?: string } | undefined;
            const event = a.event as { title?: string } | null | undefined;
            return (
            <Card key={String(a.id)}>
              <CardContent className="flex justify-between p-4">
                <div>
                  <p className="font-medium">{dojo?.name ?? "—"}</p>
                  <p className="text-sm text-muted-foreground">
                    {event?.title || String(a.method ?? "—")}
                  </p>
                </div>
                <Badge variant="secondary">
                  {new Date(String(a.checkInAt)).toLocaleString("id-ID")}
                </Badge>
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
