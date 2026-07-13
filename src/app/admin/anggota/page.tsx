import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { buildAnggotaFilter, canAccessAdmin, ROLE_LABELS } from "@/lib/rbac";
import { AppSidebar, UserMenu } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function AdminAnggotaPage() {
  const session = await auth();
  if (!session || !canAccessAdmin(session.user)) redirect("/login");

  const anggota = await prisma.anggota.findMany({
    where: buildAnggotaFilter(session.user),
    include: {
      dojo: { include: { cabang: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex min-h-screen">
      <AppSidebar
        title="Admin Panel"
        links={[
          { href: "/admin", label: "Beranda Admin" },
          { href: "/admin/anggota", label: "Kelola Anggota", active: true },
        ]}
      />
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b px-4 sm:px-6">
          <h1 className="text-lg font-bold lg:hidden">Kelola Anggota</h1>
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
              {ROLE_LABELS[session.user.role]} — {anggota.length} anggota dalam
              scope Anda
            </p>
          </div>

          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No. Induk</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead>Sabuk</TableHead>
                  <TableHead className="hidden sm:table-cell">
                    Dojo/Ranting
                  </TableHead>
                  <TableHead className="hidden md:table-cell">Cabang</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {anggota.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono text-sm">
                      {a.nomorInduk}
                    </TableCell>
                    <TableCell className="font-medium">{a.nama}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{a.sabuk}</Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {a.dojo.nama}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {a.dojo.cabang.nama}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </main>
      </div>
    </div>
  );
}
