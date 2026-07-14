import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function MemberKegiatanPage() {
  const session = await auth();
  if (!session?.user.memberId) redirect("/login");

  const registrations = await prisma.eventRegistration.findMany({
    where: { memberId: session.user.memberId },
    include: { event: true, category: true },
    orderBy: { createdAt: "desc" },
  });

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
          {registrations.map((r) => (
            <Card key={r.id}>
              <CardContent className="flex justify-between p-4">
                <div>
                  <p className="font-medium">{r.event.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(r.event.startDate).toLocaleDateString("id-ID")}
                    {r.category && ` · ${r.category.name}`}
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
