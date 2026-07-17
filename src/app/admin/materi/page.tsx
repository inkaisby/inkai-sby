import { Suspense } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { canAccessAdmin } from "@/lib/rbac";
import { prisma, withPrismaFallback } from "@/lib/prisma";
import { MateriManager } from "./MateriManager";
import { AdminPageLoader } from "@/components/ui/AdminPageLoader";

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
    () => prisma.digitalMaterial.findMany({ orderBy: { createdAt: "desc" } }),
    [],
  );

  return (
    <>
      <h2 className="mb-2 text-2xl font-bold">Materi Digital</h2>
      <p className="mb-6 text-muted-foreground">
        Kelola materi yang tampil di dashboard anggota.
      </p>
      <MateriManager initialItems={result.data} />
    </>
  );
}
