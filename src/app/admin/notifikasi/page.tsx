import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { canAccessAdmin } from "@/lib/rbac";
import { fetchAllNotifications } from "@/lib/inkai-api/admin-data";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminNotifikasiPage() {
  const session = await auth();
  if (!session || !canAccessAdmin(session.user)) redirect("/login");
  if (!session.accessToken) redirect("/login");

  const notifications = await fetchAllNotifications(session.accessToken, 100);

  return (
    <>
      <h2 className="mb-6 text-2xl font-bold">Notifikasi Admin</h2>
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
