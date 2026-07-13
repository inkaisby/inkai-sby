import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  buildMemberFilter,
  canAccessAdmin,
  getPrimaryAdminRole,
  ROLE_LABELS,
} from "@/lib/rbac";
import { AppSidebar, UserMenu } from "@/components/layout/AppShell";
import {
  ADMIN_LINKS,
  MobileDashboardNav,
} from "@/components/layout/MobileDashboardNav";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MemberActions } from "./MemberActions";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ q?: string; status?: string; page?: string }>;

export default async function AdminAnggotaPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  if (!session || !canAccessAdmin(session.user)) redirect("/login");

  const params = await searchParams;
  const q = params.q?.trim() || "";
  const status = params.status?.trim() || "";
  const page = Math.max(1, parseInt(params.page || "1", 10));
  const pageSize = 20;

  const where = {
    ...buildMemberFilter(session.user),
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { fullName: { contains: q, mode: "insensitive" as const } },
            { nia: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [members, total] = await Promise.all([
    prisma.member.findMany({
      where,
      include: { dojo: { include: { branch: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.member.count({ where }),
  ]);

  const primaryRole = getPrimaryAdminRole(session.user.roles);
  const totalPages = Math.ceil(total / pageSize);
  const links = ADMIN_LINKS.map((l) => ({
    ...l,
    active: l.href === "/admin/anggota",
  }));

  return (
    <div className="flex min-h-screen">
      <AppSidebar title="Admin Panel" links={links} />
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <MobileDashboardNav title="Admin Panel" links={links} />
            <h1 className="text-lg font-bold hidden sm:block">Kelola Anggota</h1>
          </div>
          <UserMenu
            name={session.user.name}
            email={session.user.email}
            showAdmin
          />
        </header>
        <main className="flex-1 p-4 sm:p-6">
          <div className="mb-6">
            <h2 className="text-2xl font-bold">Kelola Anggota</h2>
            <p className="text-muted-foreground">
              {ROLE_LABELS[primaryRole] || primaryRole} — {total} anggota
            </p>
          </div>

          <form className="mb-4 flex flex-wrap gap-2">
            <Input
              name="q"
              placeholder="Cari nama / NIA..."
              defaultValue={q}
              className="max-w-xs"
            />
            <select
              name="status"
              defaultValue={status}
              className="h-8 rounded-lg border px-2 text-sm"
            >
              <option value="">Semua status</option>
              <option value="PENDING">PENDING</option>
              <option value="Active">Active</option>
              <option value="REJECTED">REJECTED</option>
            </select>
            <button
              type="submit"
              className="rounded-lg bg-inkai-red px-4 py-1.5 text-sm text-white"
            >
              Filter
            </button>
          </form>

          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>NIA</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead>Sabuk</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden sm:table-cell">Dojo</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono text-sm">
                      {m.nia || "-"}
                    </TableCell>
                    <TableCell className="font-medium">{m.fullName}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{m.currentRank}</Badge>
                    </TableCell>
                    <TableCell>{m.status}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {m.dojo.name}
                    </TableCell>
                    <TableCell>
                      <MemberActions memberId={m.id} status={m.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex gap-2 text-sm">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <a
                  key={p}
                  href={`?q=${encodeURIComponent(q)}&status=${status}&page=${p}`}
                  className={`rounded px-2 py-1 ${p === page ? "bg-inkai-red text-white" : "border"}`}
                >
                  {p}
                </a>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
