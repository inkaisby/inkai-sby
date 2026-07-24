import { Suspense } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { canAccessAdmin } from "@/lib/rbac";
import {
  adminFallbackPath,
  canAccessAdminPath,
} from "@/lib/admin-page-access";
import { prisma } from "@/lib/prisma";
import { AdminPageLoader } from "@/components/ui/AdminPageLoader";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import {
  ApresiasiManager,
  type AppreciationAdminItem,
} from "./ApresiasiManager";

export const dynamic = "force-dynamic";

export default function AdminApresiasiPage() {
  return (
    <Suspense fallback={<AdminPageLoader rows={3} />}>
      <AdminApresiasiContent />
    </Suspense>
  );
}

async function AdminApresiasiContent() {
  const session = await auth();
  if (!session || !canAccessAdmin(session.user)) redirect("/login");
  if (!canAccessAdminPath(session.user.roles ?? [], "/admin/apresiasi")) {
    redirect(adminFallbackPath(session.user.roles ?? []));
  }

  const rows = await prisma.appreciationEntry.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
  });

  const items: AppreciationAdminItem[] = rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    name: r.name,
    title: r.title,
    summary: r.summary,
    photoUrl: r.photoUrl,
    eventDate: r.eventDate?.toISOString() ?? null,
    order: r.order,
    isActive: r.isActive,
  }));

  return (
    <>
      <AdminPageHeader title="Apresiasi publik" />
      <p className="mb-6 text-sm text-muted-foreground">
        Kelola kenangan (in memoriam) dan prestasi anggota untuk halaman publik
        /apresiasi serta cuplikan beranda.
      </p>
      <ApresiasiManager initialItems={items} />
    </>
  );
}
