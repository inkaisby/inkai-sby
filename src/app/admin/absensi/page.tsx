import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { buildAttendanceFilter, canAccessAdmin } from "@/lib/rbac";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ date?: string; q?: string }>;

export default async function AdminAbsensiPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  if (!session || !canAccessAdmin(session.user)) redirect("/login");

  const params = await searchParams;
  const q = params.q?.trim() || "";
  const dateStr = params.date?.trim() || "";

  const dateFilter = dateStr
    ? {
        gte: new Date(`${dateStr}T00:00:00`),
        lt: new Date(`${dateStr}T23:59:59.999`),
      }
    : undefined;

  const logs = await prisma.attendance.findMany({
    where: {
      ...buildAttendanceFilter(session.user),
      ...(dateFilter ? { checkInAt: dateFilter } : {}),
      ...(q
        ? {
            member: {
              ...buildAttendanceFilter(session.user).member,
              OR: [
                { fullName: { contains: q, mode: "insensitive" as const } },
                { nia: { contains: q, mode: "insensitive" as const } },
              ],
            },
          }
        : {}),
    },
    include: {
      member: { select: { fullName: true, nia: true } },
      dojo: { select: { name: true } },
      event: { select: { title: true } },
    },
    orderBy: { checkInAt: "desc" },
    take: 200,
  });

  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Laporan Absensi</h2>
        <p className="text-muted-foreground">
          {logs.length} catatan absensi
        </p>
      </div>

      <form className="mb-4 flex flex-wrap gap-2">
        <Input
          name="date"
          type="date"
          defaultValue={dateStr || today}
          className="max-w-[180px]"
        />
        <Input
          name="q"
          placeholder="Cari nama / NIA..."
          defaultValue={q}
          className="max-w-xs"
        />
        <button
          type="submit"
          className="rounded-lg bg-inkai-red px-4 py-1.5 text-sm text-white"
        >
          Filter
        </button>
      </form>

      {logs.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Tidak ada data absensi untuk filter ini.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <Card key={log.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
                <div>
                  <p className="font-medium">{log.member.fullName}</p>
                  <p className="text-muted-foreground">
                    {log.member.nia || "—"} · {log.dojo.name}
                    {log.event && ` · ${log.event.title}`}
                  </p>
                </div>
                <Badge variant="secondary">
                  {new Date(log.checkInAt).toLocaleString("id-ID")}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
