import { Suspense } from "react";
import { auth } from "@/auth";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import { redirect } from "next/navigation";
import { canAccessAdmin } from "@/lib/rbac";
import { fetchAdminEvents } from "@/lib/inkai-api/admin-data";
import { canCreateEventsByWilayah } from "@/lib/wilayah-rbac";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { AdminPageLoader } from "@/components/ui/AdminPageLoader";
import { CreateEventForm } from "@/components/admin/CreateEventForm";
import { buildUktAdminUrlFromEvent } from "@/lib/ukt";

export const dynamic = "force-dynamic";

export default function AdminKegiatanPage() {
  return (
    <Suspense fallback={<AdminPageLoader rows={4} />}>
      <AdminKegiatanContent />
    </Suspense>
  );
}

async function AdminKegiatanContent() {
  const session = await auth();
  if (!session || !canAccessAdmin(session.user)) redirect("/login");
  const token = await getInkaiAccessToken();
  if (!token) redirect("/login");

  const events = await fetchAdminEvents(token, 50);
  const now = Date.now();
  const canCreate = canCreateEventsByWilayah(session.user.roles ?? []);

  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Event & Kegiatan</h2>
        <p className="text-muted-foreground">
          Kelola event cabang (UKT, Gashuku, pertandingan, dll.) — {events.length}{" "}
          kegiatan
        </p>
      </div>

      <CreateEventForm canCreate={canCreate} />

      {events.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Belum ada event dalam scope Anda.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {events.map((e) => {
            const isPast = new Date(String(e.endDate)).getTime() < now;
            const branch = e.branch as { name?: string } | undefined;
            const count =
              (e._count as { registrations?: number } | undefined)
                ?.registrations ?? 0;
            const isUkt = String(e.title).toUpperCase().includes("UKT");
            return (
              <Card key={String(e.id)}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <p className="font-medium">{String(e.title)}</p>
                      <Badge variant={isPast ? "secondary" : "default"}>
                        {isPast ? "Selesai" : "Aktif"}
                      </Badge>
                      {isUkt ? <Badge variant="outline">UKT</Badge> : null}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {new Date(String(e.startDate)).toLocaleDateString("id-ID")}
                      {e.endDate != null &&
                        ` – ${new Date(String(e.endDate)).toLocaleDateString("id-ID")}`}
                      {e.location != null &&
                        e.location !== "" &&
                        ` · ${String(e.location)}`}
                      {branch && ` · ${branch.name}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {count} pendaftar
                    </p>
                  </div>
                  <div className="flex gap-3">
                    {isUkt ? (
                      <Link
                        href={buildUktAdminUrlFromEvent(String(e.title), String(e.id))}
                        className="text-sm text-inkai-red hover:underline"
                      >
                        Kelola UKT →
                      </Link>
                    ) : null}
                    <Link
                      href={`/kegiatan/${e.id}`}
                      className="text-sm text-inkai-red hover:underline"
                    >
                      Detail publik →
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
