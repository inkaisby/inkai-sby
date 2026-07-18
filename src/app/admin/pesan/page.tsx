import { Suspense } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { buildDojoFilter, canAccessAdmin } from "@/lib/rbac";
import { prisma, withPrismaFallback } from "@/lib/prisma";
import { AdminPesanClient } from "./AdminPesanClient";
import { AdminPageLoader } from "@/components/ui/AdminPageLoader";

export const dynamic = "force-dynamic";

export default function AdminPesanPage() {
  return (
    <Suspense fallback={<AdminPageLoader rows={4} />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const session = await auth();
  if (!session || !canAccessAdmin(session.user)) redirect("/login");

  const dojosResult = await withPrismaFallback(
    "admin-pesan-dojos",
    () =>
      prisma.dojo.findMany({
        where: buildDojoFilter(session.user),
        select: { id: true, name: true },
        orderBy: { name: "asc" },
        take: 200,
      }),
    [],
  );

  return (
    <>
      <h2 className="mb-2 text-2xl font-bold">Pesan Anggota</h2>
      <p className="mb-6 text-muted-foreground">
        Balas chat dari anggota, cari percakapan, atau kirim broadcast notifikasi.
      </p>
      <AdminPesanClient dojos={dojosResult.data ?? []} />
    </>
  );
}
