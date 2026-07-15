import { Suspense } from "react";
import { auth } from "@/auth";
import { getInkaiAccessToken } from "@/lib/inkai-api/session";
import { redirect } from "next/navigation";
import { canAccessAdmin } from "@/lib/rbac";
import { fetchAttendanceLogs } from "@/lib/inkai-api/admin-data";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AdminPageLoader } from "@/components/ui/AdminPageLoader";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ date?: string; q?: string }>;

export default function AdminAbsensiPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <Suspense fallback={<AdminPageLoader rows={6} />}>
      <AdminAbsensiContent searchParams={searchParams} />
    </Suspense>
  );
}

async function AdminAbsensiContent({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  if (!session || !canAccessAdmin(session.user)) redirect("/login");
  const token = await getInkaiAccessToken();
  if (!token) redirect("/login");

  const params = await searchParams;
  const q = params.q?.trim() || "";
  const today = new Date().toISOString().slice(0, 10);
  const dateStr = params.date?.trim() || today;

  let logs = await fetchAttendanceLogs(token, {
    date: dateStr,
    limit: 200,
  });

  if (q) {
    const lower = q.toLowerCase();
    logs = logs.filter((log) => {
      const member = log.member as { fullName?: string; nia?: string } | undefined;
      return (
        member?.fullName?.toLowerCase().includes(lower) ||
        member?.nia?.toLowerCase().includes(lower)
      );
    });
  }

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
          defaultValue={dateStr}
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
          {logs.map((log) => {
            const member = log.member as { fullName?: string; nia?: string } | undefined;
            const dojo = log.dojo as { name?: string } | undefined;
            const event = log.event as { title?: string } | null | undefined;
            return (
            <Card key={String(log.id)}>
              <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
                <div>
                  <p className="font-medium">{member?.fullName ?? "—"}</p>
                  <p className="text-muted-foreground">
                    {member?.nia || "—"} · {dojo?.name ?? "—"}
                    {event && ` · ${event.title}`}
                  </p>
                </div>
                <Badge variant="secondary">
                  {new Date(String(log.checkInAt)).toLocaleString("id-ID")}
                </Badge>
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
