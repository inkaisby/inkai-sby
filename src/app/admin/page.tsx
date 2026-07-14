import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  buildMemberFilter,
  buildDojoFilter,
  buildBranchFilter,
  canAccessAdmin,
  getAdminScopeLabel,
  getPrimaryAdminRole,
  ROLE_LABELS,
  buildEventFilter,
  buildVerificationFilter,
  buildBillingFilter,
} from "@/lib/rbac";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Users,
  Building2,
  MapPin,
  Home,
  Calendar,
  ShieldCheck,
  Wallet,
  Plus,
  ClipboardCheck,
  ChevronRight,
  Map,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const session = await auth();
  if (!session || !canAccessAdmin(session.user)) redirect("/login");

  const user = session.user;
  const memberFilter = buildMemberFilter(user);
  const dojoFilter = buildDojoFilter(user);
  const branchFilter = buildBranchFilter(user);
  const eventFilter = buildEventFilter(user);
  const verificationFilter = buildVerificationFilter(user);
  const billingFilter = buildBillingFilter(user);
  const primaryRole = getPrimaryAdminRole(user.roles);
  const includeBranches = [
    "ADMINISTRATOR",
    "ADMIN_PUSAT",
    "ADMIN_PROVINCE",
    "ADMIN",
  ].includes(primaryRole);

  let totalMembers = 0;
  let totalDojos = 0;
  let totalBranches = 0;
  let recentMembers: Awaited<
    ReturnType<
      typeof prisma.member.findMany<{ include: { dojo: true } }>
    >
  > = [];
  let pendingCount = 0;
  let pendingVerifications = 0;
  let pendingBillings = 0;
  let upcomingEvents: Awaited<
    ReturnType<
      typeof prisma.event.findMany<{
        include: { _count: { select: { registrations: true } } };
      }>
    >
  > = [];
  let recentNotifications: Awaited<ReturnType<typeof prisma.notification.findMany>> = [];
  let unreadNotifications = 0;

  try {
    // Single DB connection via interactive transaction (avoids Supabase pool exhaustion)
    const result = await prisma.$transaction(async (tx) => {
      const [
        members,
        dojos,
        branches,
        recent,
        pending,
        verifications,
        billings,
        events,
        notifications,
        unread,
      ] = await Promise.all([
        tx.member.count({ where: memberFilter }),
        tx.dojo.count({ where: dojoFilter }),
        includeBranches
          ? tx.branch.count({ where: branchFilter })
          : Promise.resolve(0),
        tx.member.findMany({
          where: memberFilter,
          include: { dojo: true },
          orderBy: { createdAt: "desc" },
          take: 5,
        }),
        tx.member.count({
          where: { ...memberFilter, status: "PENDING" },
        }),
        tx.verification.count({
          where: { ...verificationFilter, status: "PENDING" },
        }),
        tx.billing.count({
          where: { ...billingFilter, status: "WAITING_VERIFICATION" },
        }),
        tx.event.findMany({
          where: { ...eventFilter, startDate: { gte: new Date() } },
          orderBy: { startDate: "asc" },
          take: 3,
          include: { _count: { select: { registrations: true } } },
        }),
        tx.notification.findMany({
          where: { userId: session.user.id },
          orderBy: { createdAt: "desc" },
          take: 5,
        }),
        tx.notification.count({
          where: { userId: session.user.id, isRead: false },
        }),
      ]);

      return {
        members,
        dojos,
        branches,
        recent,
        pending,
        verifications,
        billings,
        events,
        notifications,
        unread,
      };
    });

    totalMembers = result.members;
    totalDojos = result.dojos;
    totalBranches = result.branches;
    recentMembers = result.recent;
    pendingCount = result.pending;
    pendingVerifications = result.verifications;
    pendingBillings = result.billings;
    upcomingEvents = result.events;
    recentNotifications = result.notifications;
    unreadNotifications = result.unread;
  } catch (error) {
    console.error("[AdminDashboard] DB error:", error);
    throw error;
  }

  const stats = [
    {
      label: "Total Anggota",
      value: totalMembers,
      icon: Users,
      href: "/admin/anggota",
      show: true,
    },
    {
      label: "Menunggu Approval",
      value: pendingCount,
      icon: Users,
      href: "/admin/anggota?status=PENDING",
      show: true,
    },
    {
      label: "Verifikasi Pending",
      value: pendingVerifications,
      icon: ShieldCheck,
      href: "/admin/verifikasi",
      show: true,
    },
    {
      label: "Iuran Menunggu",
      value: pendingBillings,
      icon: Wallet,
      href: "/admin/iuran?status=WAITING_VERIFICATION",
      show: true,
    },
    {
      label: "Dojo/Ranting",
      value: totalDojos,
      icon: Home,
      href: "/admin/organisasi",
      show: primaryRole !== "ADMIN_DOJO",
    },
    {
      label: "Cabang",
      value: totalBranches,
      icon: Building2,
      href: "/admin/organisasi",
      show: includeBranches,
    },
  ].filter((s) => s.show);

  const quickActions = [
    {
      label: "Tambah / Kelola Anggota",
      desc: "Approval pendaftar & kelola NIA",
      href: "/admin/anggota",
      icon: Plus,
    },
    {
      label: "Laporan Absensi",
      desc: "Pantau kehadiran latihan",
      href: "/admin/absensi",
      icon: ClipboardCheck,
    },
    {
      label: "Verifikasi Iuran",
      desc: "Setujui bukti transfer anggota",
      href: "/admin/iuran",
      icon: Wallet,
    },
    {
      label: "Kelola Organisasi",
      desc: "Cabang, dojo, dan ranting",
      href: "/admin/organisasi",
      icon: Map,
    },
  ];

  return (
    <>
      <div className="mb-6">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h2 className="text-2xl font-bold">Beranda Admin</h2>
          <Badge className="bg-inkai-red text-white hover:bg-inkai-red">
            {ROLE_LABELS[primaryRole] || primaryRole}
          </Badge>
          {unreadNotifications > 0 && (
            <Badge variant="outline" className="border-inkai-red text-inkai-red">
              {unreadNotifications} notifikasi baru
            </Badge>
          )}
        </div>
        <p className="flex items-center gap-1 text-muted-foreground">
          <MapPin className="h-4 w-4" />
          Scope: {getAdminScopeLabel(user)}
        </p>
      </div>

      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {quickActions.map((action) => (
          <Link key={action.href} href={action.href}>
            <Card className="inkai-card-hover h-full cursor-pointer transition-colors hover:border-inkai-red/30">
              <CardContent className="flex items-start gap-3 p-4">
                <div className="rounded-lg bg-inkai-red/10 p-2 text-inkai-red">
                  <action.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{action.label}</p>
                  <p className="text-xs text-muted-foreground">{action.desc}</p>
                </div>
                <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {(pendingCount > 0 || pendingVerifications > 0 || pendingBillings > 0) && (
        <Card className="mb-6 border-inkai-yellow/40 bg-inkai-yellow/10">
          <CardContent className="space-y-1 p-4 text-sm">
            {pendingCount > 0 && (
              <p>
                <b>{pendingCount}</b> pendaftar menunggu persetujuan.{" "}
                <Link href="/admin/anggota?status=PENDING" className="text-inkai-red hover:underline">
                  Tinjau →
                </Link>
              </p>
            )}
            {pendingVerifications > 0 && (
              <p>
                <b>{pendingVerifications}</b> pengajuan verifikasi pending.{" "}
                <Link href="/admin/verifikasi" className="text-inkai-red hover:underline">
                  Tinjau →
                </Link>
              </p>
            )}
            {pendingBillings > 0 && (
              <p>
                <b>{pendingBillings}</b> bukti iuran menunggu verifikasi.{" "}
                <Link href="/admin/iuran?status=WAITING_VERIFICATION" className="text-inkai-red hover:underline">
                  Tinjau →
                </Link>
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card className="inkai-card-hover cursor-pointer transition-colors hover:border-inkai-red/20">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </CardTitle>
                <stat.icon className="h-4 w-4 text-inkai-red" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{stat.value}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Anggota Terbaru</CardTitle>
            <Button asChild variant="ghost" size="sm" className="text-inkai-red">
              <Link href="/admin/anggota">Lihat semua</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentMembers.length === 0 ? (
              <p className="text-muted-foreground">Belum ada anggota.</p>
            ) : (
              <div className="space-y-3">
                {recentMembers.map((m) => (
                  <Link
                    key={m.id}
                    href={`/admin/anggota?q=${encodeURIComponent(m.fullName)}`}
                    className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                  >
                    <div>
                      <p className="font-medium">{m.fullName}</p>
                      <p className="text-sm text-muted-foreground">
                        {m.nia || "NIA belum ada"} · {m.dojo.name} · {m.status}
                      </p>
                    </div>
                    <Badge variant="secondary">{m.currentRank}</Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Event Mendatang
            </CardTitle>
            <Button asChild variant="ghost" size="sm" className="text-inkai-red">
              <Link href="/admin/kegiatan">Kelola</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {upcomingEvents.length === 0 ? (
              <p className="text-muted-foreground">Belum ada event mendatang.</p>
            ) : (
              <div className="space-y-3">
                {upcomingEvents.map((e) => (
                  <div key={e.id} className="rounded-lg border p-3">
                    <p className="font-medium">{e.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(e.startDate).toLocaleDateString("id-ID")} ·{" "}
                      {e._count.registrations} pendaftar
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {recentNotifications.length > 0 && (
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Notifikasi Terbaru</CardTitle>
              <Button asChild variant="ghost" size="sm" className="text-inkai-red">
                <Link href="/admin/notifikasi">Lihat semua</Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {recentNotifications.map((n) => (
                <div
                  key={n.id}
                  className={`rounded-lg border p-3 text-sm ${
                    !n.isRead ? "border-inkai-red/30 bg-inkai-red/5" : ""
                  }`}
                >
                  <p className="font-medium">{n.title}</p>
                  <p className="text-muted-foreground">{n.content}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
