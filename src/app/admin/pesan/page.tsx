import { Suspense } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { buildDojoFilter, canAccessAdmin } from "@/lib/rbac";
import { prisma, withPrismaFallback } from "@/lib/prisma";
import { AdminPesanClient } from "./AdminPesanClient";
import { AdminPageLoader } from "@/components/ui/AdminPageLoader";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

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
      <AdminPageHeader
        title="Pesan Anggota"
        description="Balas chat dari anggota, cari percakapan, atau kirim broadcast notifikasi."
      />
      <AdminPesanClient dojos={dojosResult.data ?? []} />
    </>
  );
}
