import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { fetchMyEventRegistrations } from "@/lib/inkai-api/member-data";

export const dynamic = "force-dynamic";

export default async function MemberKegiatanPage() {
  const session = await auth();
  if (!session?.user.memberId) redirect("/login");
  if (!session.accessToken) redirect("/login");

  const registrations = await fetchMyEventRegistrations(session.accessToken);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl font-bold">Kegiatan Saya</h2>
        <Link href="/kegiatan" className="text-sm text-inkai-red hover:underline">
          Lihat semua kegiatan →
        </Link>
      </div>
      {registrations.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Anda belum terdaftar di kegiatan manapun.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {registrations.map((r) => {
            const event = r.event as { title?: string; startDate?: string } | undefined;
            const category = r.category as { name?: string } | null | undefined;
            return (
            <Card key={String(r.id)}>
              <CardContent className="flex justify-between p-4">
                <div>
                  <p className="font-medium">{event?.title ?? "—"}</p>
                  <p className="text-sm text-muted-foreground">
                    {event?.startDate
                      ? new Date(event.startDate).toLocaleDateString("id-ID")
                      : "—"}
                    {category && ` · ${category.name}`}
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
