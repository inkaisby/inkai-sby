import { Suspense } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { canAccessAdmin } from "@/lib/rbac";
import { prisma, withPrismaFallback } from "@/lib/prisma";
import { MateriManager } from "./MateriManager";
import { AdminPageLoader } from "@/components/ui/AdminPageLoader";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

export const dynamic = "force-dynamic";

export default function AdminMateriPage() {
  return (
    <Suspense fallback={<AdminPageLoader rows={3} />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const session = await auth();
  if (!session || !canAccessAdmin(session.user)) redirect("/login");

  const result = await withPrismaFallback(
    "admin-materi-page",
    () => prisma.digitalMaterial.findMany({ orderBy: { createdAt: "desc" }, take: 200 }),
    [],
  );

  return (
    <>
      <AdminPageHeader
        title="Materi Digital"
        description="Kelola materi yang tampil di dashboard anggota."
      />
      <MateriManager initialItems={result.data} />
    </>
  );
}
