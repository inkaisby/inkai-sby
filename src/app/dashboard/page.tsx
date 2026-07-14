import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Award,
  MapPin,
  Calendar,
  Bell,
  Wallet,
  ClipboardCheck,
  Trophy,
} from "lucide-react";

export const dynamic = "force-dynamic";

function semesterAttendancePct(attendances: { checkInAt: Date }[]) {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const isFirstSemester = currentMonth < 6;

  const count = attendances.filter((h) => {
    const d = new Date(h.checkInAt);
    const isFirst = d.getMonth() < 6;
    return isFirst === isFirstSemester && d.getFullYear() === currentYear;
  }).length;

  const totalSessions = 48;
  const pct =
    totalSessions > 0
      ? Math.min(100, Math.round((count / totalSessions) * 1000) / 10)
      : 0;

  return { count, totalSessions, pct, isFirstSemester };
}

export default async function MemberDashboard() {
  const session = await auth();
  if (!session) redirect("/login");

  const member = session.user.memberId
    ? await prisma.member.findFirst({
        where: { id: session.user.memberId, isDeleted: false },
        include: {
          dojo: { include: { branch: { include: { province: true } } } },
          ranks: { orderBy: { date: "desc" }, take: 1 },
        },
      })
    : null;

  const [notifications, attendances, billings, registrations, upcomingEvents] =
    await Promise.all([
      prisma.notification.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      member
        ? prisma.attendance.findMany({
            where: { memberId: member.id, isDeleted: false },
            orderBy: { checkInAt: "desc" },
            take: 100,
          })
        : Promise.resolve([]),
      member
        ? prisma.billing.findMany({
            where: { memberId: member.id, isDeleted: false },
            orderBy: { dueDate: "desc" },
            take: 12,
          })
        : Promise.resolve([]),
      member
        ? prisma.eventRegistration.findMany({
            where: { memberId: member.id },
            include: { event: true },
            orderBy: { createdAt: "desc" },
            take: 5,
          })
        : Promise.resolve([]),
      prisma.event.findMany({
        where: { isDeleted: false, startDate: { gte: new Date() } },
        orderBy: { startDate: "asc" },
        take: 3,
      }),
    ]);

  const attendanceStats = semesterAttendancePct(attendances);
  const unpaidMonthly = billings.filter(
    (b) => b.type === "MONTHLY_IURAN" && b.status !== "PAID"
  ).length;

  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">
          Selamat datang, {session.user.name}
        </h2>
        <p className="text-muted-foreground">Dashboard anggota INKAI Surabaya</p>
      </div>

      {member?.status === "PENDING" && (
        <Card className="mb-6 border-inkai-yellow/40 bg-inkai-yellow/10">
          <CardContent className="flex items-start gap-3 p-4">
            <Bell className="mt-0.5 h-5 w-5 shrink-0 text-inkai-yellow" />
            <div>
              <p className="font-medium">Akun sedang diverifikasi</p>
              <p className="text-sm text-muted-foreground">
                Pendaftaran Anda menunggu persetujuan admin. Anda akan menerima
                notifikasi setelah NIA aktif.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {unpaidMonthly > 0 && member?.status === "Active" && (
        <Card className="mb-6 border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3">
              <Wallet className="h-5 w-5 text-amber-600" />
              <p className="text-sm">
                Anda memiliki <b>{unpaidMonthly}</b> tagihan iuran belum lunas.
              </p>
            </div>
            <Link
              href="/dashboard/iuran"
              className="text-sm font-medium text-inkai-red hover:underline"
            >
              Bayar iuran →
            </Link>
          </CardContent>
        </Card>
      )}

      {member ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                NIA
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-inkai-red">
                {member.nia || "Memproses..."}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Award className="h-4 w-4" />
                Sabuk / Kyu
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Badge className="bg-inkai-yellow text-inkai-black hover:bg-inkai-yellow">
                {member.currentRank}
              </Badge>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <ClipboardCheck className="h-4 w-4" />
                Kehadiran Semester
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p
                className={`text-2xl font-bold ${
                  attendanceStats.pct >= 75 ? "text-green-600" : "text-amber-600"
                }`}
              >
                {attendanceStats.pct}%
              </p>
              <p className="text-xs text-muted-foreground">
                {attendanceStats.count}/{attendanceStats.totalSessions} latihan
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <MapPin className="h-4 w-4" />
                Dojo/Ranting
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Link
                href={`/dojo/${member.dojoId}`}
                className="font-semibold hover:text-inkai-red"
              >
                {member.dojo.name}
              </Link>
              <p className="text-sm text-muted-foreground">
                {member.dojo.branch.name}
              </p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="mb-6">
          <CardContent className="p-8 text-center text-muted-foreground">
            Data anggota belum tersedia. Hubungi admin cabang/dojo Anda.
          </CardContent>
        </Card>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {notifications.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Bell className="h-4 w-4" />
                Notifikasi Terbaru
              </CardTitle>
              <Link
                href="/dashboard/notifikasi"
                className="text-xs text-inkai-red hover:underline"
              >
                Lihat semua
              </Link>
            </CardHeader>
            <CardContent className="space-y-2">
              {notifications.map((n) => (
                <div key={n.id} className="rounded-lg border p-3 text-sm">
                  <p className="font-medium">{n.title}</p>
                  <p className="text-muted-foreground">{n.content}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="h-4 w-4" />
              Event Terdekat
            </CardTitle>
            <Link href="/kegiatan" className="text-xs text-inkai-red hover:underline">
              Lihat semua
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcomingEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Belum ada event terdekat.
              </p>
            ) : (
              upcomingEvents.map((e) => (
                <Link
                  key={e.id}
                  href={`/kegiatan/${e.id}`}
                  className="block rounded-lg border p-3 text-sm transition-colors hover:bg-muted/50"
                >
                  <p className="font-medium">{e.title}</p>
                  <p className="text-muted-foreground">
                    {new Date(e.startDate).toLocaleDateString("id-ID")}
                    {e.location ? ` · ${e.location}` : ""}
                  </p>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        {registrations.length > 0 && (
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="h-4 w-4" />
                Kegiatan Saya
              </CardTitle>
              <Link
                href="/dashboard/kegiatan"
                className="text-xs text-inkai-red hover:underline"
              >
                Lihat semua
              </Link>
            </CardHeader>
            <CardContent className="space-y-2">
              {registrations.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-lg border p-3 text-sm"
                >
                  <div>
                    <p className="font-medium">{r.event.title}</p>
                    <p className="text-muted-foreground">
                      {new Date(r.event.startDate).toLocaleDateString("id-ID")}
                    </p>
                  </div>
                  <Badge variant="secondary">{r.status}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
