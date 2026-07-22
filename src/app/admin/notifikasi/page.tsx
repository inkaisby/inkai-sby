import { Suspense } from "react";
import { redirect } from "next/navigation";
import { fetchAllNotifications } from "@/lib/inkai-api/admin-data";
import { requireAdminSession } from "@/lib/admin-session";
import { extractDojoLabelFromNotificationText } from "@/lib/notification-display";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AdminPageLoader } from "@/components/ui/AdminPageLoader";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

export const dynamic = "force-dynamic";

export default function AdminNotifikasiPage() {
  return (
    <Suspense fallback={<AdminPageLoader rows={5} />}>
      <AdminNotifikasiContent />
    </Suspense>
  );
}

async function AdminNotifikasiContent() {
  const { user, token } = await requireAdminSession();
  if (!token) redirect("/login");

  const notifications = await fetchAllNotifications(token, 100, user);

  return (
    <>
      <AdminPageHeader title="Notifikasi Admin" />
      {notifications.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Belum ada notifikasi.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => {
            const content = String(n.content ?? "");
            const ranting = extractDojoLabelFromNotificationText(
              `${String(n.title ?? "")} ${content}`,
            );
            return (
              <Card
                key={String(n.id)}
                className={n.isRead ? "" : "border-inkai-red/30"}
              >
                <CardContent className="p-4">
                  <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{String(n.title)}</p>
                    <div className="flex items-center gap-2">
                      {ranting ? (
                        <Badge variant="outline" className="font-normal">
                          {ranting}
                        </Badge>
                      ) : null}
                      <Badge variant="outline">{String(n.type)}</Badge>
                      {!n.isRead && (
                        <Badge className="bg-inkai-red text-white">Baru</Badge>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{content}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {new Date(String(n.createdAt)).toLocaleString("id-ID")}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
