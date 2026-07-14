import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AbsensiPage() {
  const session = await auth();
  if (!session?.user.memberId) redirect("/login");

  const attendances = await prisma.attendance.findMany({
    where: { memberId: session.user.memberId, isDeleted: false },
    include: { dojo: true, event: true },
    orderBy: { checkInAt: "desc" },
    take: 50,
  });

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
          {attendances.map((a) => (
            <Card key={a.id}>
              <CardContent className="flex justify-between p-4">
                <div>
                  <p className="font-medium">{a.dojo.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {a.event?.title || a.method}
                  </p>
                </div>
                <Badge variant="secondary">
                  {new Date(a.checkInAt).toLocaleString("id-ID")}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
