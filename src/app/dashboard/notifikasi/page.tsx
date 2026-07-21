import { auth } from "@/auth";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { fetchMyNotifications } from "@/lib/inkai-api/member-data";
import { MemberPageHeader } from "@/components/member/MemberPageHeader";

export const dynamic = "force-dynamic";

export default async function NotifikasiPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const token = await getInkaiAccessToken();
  if (!token) redirect("/login");

  const notifications = await fetchMyNotifications(token, 100, session.user.id);

  return (
    <>
      <MemberPageHeader title="Notifikasi" />
      {notifications.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Belum ada notifikasi.
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <div
              key={String(n.id)}
              className={`rounded-2xl border bg-card p-4 ${
                n.isRead ? "border-border/60" : "border-inkai-red/30 bg-inkai-red/5"
              }`}
            >
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">{String(n.title)}</p>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    {String(n.type)}
                  </Badge>
                  {!n.isRead && (
                    <Badge className="bg-inkai-red text-white">Baru</Badge>
                  )}
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{String(n.content)}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {new Date(String(n.createdAt)).toLocaleString("id-ID")}
              </p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
