import { auth } from "@/auth";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { fetchMyNotifications } from "@/lib/inkai-api/member-data";

export const dynamic = "force-dynamic";

export default async function NotifikasiPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const token = await getInkaiAccessToken();
  if (!token) redirect("/login");

  const notifications = await fetchMyNotifications(token, 100);

  return (
    <>
      <h2 className="mb-6 text-2xl font-bold">Notifikasi</h2>
      {notifications.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Belum ada notifikasi.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <Card key={String(n.id)} className={n.isRead ? "" : "border-inkai-red/30"}>
              <CardContent className="p-4">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{String(n.title)}</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{String(n.type)}</Badge>
                    {!n.isRead && (
                      <Badge className="bg-inkai-red text-white">Baru</Badge>
                    )}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{String(n.content)}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {new Date(String(n.createdAt)).toLocaleString("id-ID")}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
