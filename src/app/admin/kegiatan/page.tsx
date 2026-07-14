import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { buildEventFilter, canAccessAdmin } from "@/lib/rbac";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminKegiatanPage() {
  const session = await auth();
  if (!session || !canAccessAdmin(session.user)) redirect("/login");

  const events = await prisma.event.findMany({
    where: buildEventFilter(session.user),
    include: {
      branch: true,
      _count: { select: { registrations: true } },
    },
    orderBy: { startDate: "desc" },
    take: 50,
  });

  const now = Date.now();

  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Event & Kegiatan</h2>
        <p className="text-muted-foreground">
          Data event dari Supabase — {events.length} kegiatan
        </p>
      </div>

      {events.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Belum ada event dalam scope Anda.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {events.map((e) => {
            const isPast = new Date(e.endDate).getTime() < now;
            return (
              <Card key={e.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <p className="font-medium">{e.title}</p>
                      <Badge variant={isPast ? "secondary" : "default"}>
                        {isPast ? "Selesai" : "Aktif"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {new Date(e.startDate).toLocaleDateString("id-ID")}
                      {e.endDate &&
                        ` – ${new Date(e.endDate).toLocaleDateString("id-ID")}`}
                      {e.location && ` · ${e.location}`}
                      {e.branch && ` · ${e.branch.name}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {e._count.registrations} pendaftar
                    </p>
                  </div>
                  <Link
                    href={`/kegiatan/${e.id}`}
                    className="text-sm text-inkai-red hover:underline"
                  >
                    Detail →
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
