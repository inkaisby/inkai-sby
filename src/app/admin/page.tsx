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
import { Users, Building2, MapPin, Home, Calendar, ShieldCheck, Wallet } from "lucide-react";

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

  const [
    totalMembers,
    totalDojos,
    totalBranches,
    recentMembers,
    pendingCount,
    pendingVerifications,
    pendingBillings,
    upcomingEvents,
  ] = await Promise.all([
    prisma.member.count({ where: memberFilter }),
    prisma.dojo.count({ where: dojoFilter }),
    ["ADMINISTRATOR", "ADMIN_PUSAT", "ADMIN_PROVINCE", "ADMIN"].includes(
      primaryRole
    )
      ? prisma.branch.count({ where: branchFilter })
      : Promise.resolve(0),
    prisma.member.findMany({
      where: memberFilter,
      include: { dojo: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.member.count({
      where: { ...memberFilter, status: "PENDING" },
    }),
    prisma.verification.count({
      where: { ...verificationFilter, status: "PENDING" },
    }),
    prisma.billing.count({
      where: { ...billingFilter, status: "WAITING_VERIFICATION" },
    }),
    prisma.event.findMany({
      where: { ...eventFilter, startDate: { gte: new Date() } },
      orderBy: { startDate: "asc" },
      take: 3,
      include: { _count: { select: { registrations: true } } },
    }),
  ]);

  const stats = [
    { label: "Total Anggota", value: totalMembers, icon: Users, show: true },
    { label: "Menunggu Approval", value: pendingCount, icon: Users, show: true },
    {
      label: "Verifikasi Pending",
      value: pendingVerifications,
      icon: ShieldCheck,
      show: true,
    },
    {
      label: "Iuran Menunggu",
      value: pendingBillings,
      icon: Wallet,
      show: true,
    },
    {
      label: "Dojo/Ranting",
      value: totalDojos,
      icon: Home,
      show: primaryRole !== "ADMIN_DOJO",
    },
    {
      label: "Cabang",
      value: totalBranches,
      icon: Building2,
      show: ["ADMINISTRATOR", "ADMIN_PUSAT", "ADMIN_PROVINCE", "ADMIN"].includes(
        primaryRole
      ),
    },
  ].filter((s) => s.show);

  return (
    <>
      <div className="mb-6">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h2 className="text-2xl font-bold">Beranda Admin</h2>
          <Badge className="bg-inkai-red text-white hover:bg-inkai-red">
            {ROLE_LABELS[primaryRole] || primaryRole}
          </Badge>
        </div>
        <p className="flex items-center gap-1 text-muted-foreground">
          <MapPin className="h-4 w-4" />
          Scope: {getAdminScopeLabel(user)}
        </p>
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
          <Card key={stat.label}>
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
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Anggota Terbaru</CardTitle>
            <Link href="/admin/anggota" className="text-xs text-inkai-red hover:underline">
              Lihat semua
            </Link>
          </CardHeader>
          <CardContent>
            {recentMembers.length === 0 ? (
              <p className="text-muted-foreground">Belum ada anggota.</p>
            ) : (
              <div className="space-y-3">
                {recentMembers.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="font-medium">{m.fullName}</p>
                      <p className="text-sm text-muted-foreground">
                        {m.nia || "NIA belum ada"} · {m.dojo.name} · {m.status}
                      </p>
                    </div>
                    <Badge variant="secondary">{m.currentRank}</Badge>
                  </div>
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
            <Link href="/admin/kegiatan" className="text-xs text-inkai-red hover:underline">
              Kelola
            </Link>
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
      </div>
    </>
  );
}
