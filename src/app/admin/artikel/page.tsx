import { Suspense } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { canAccessAdmin, getPrimaryAdminRole } from "@/lib/rbac";
import {
  adminFallbackPath,
  canAccessAdminPath,
} from "@/lib/admin-page-access";
import { prisma, withPrismaFallback } from "@/lib/prisma";
import { AdminPageLoader } from "@/components/ui/AdminPageLoader";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ArtikelManager, type ArticleAdminItem } from "./ArtikelManager";
import { parseArticleMedia } from "@/lib/articles";

export const dynamic = "force-dynamic";

export default function AdminArtikelPage() {
  return (
    <Suspense fallback={<AdminPageLoader rows={3} />}>
      <AdminArtikelContent />
    </Suspense>
  );
}

async function AdminArtikelContent() {
  const session = await auth();
  if (!session || !canAccessAdmin(session.user)) redirect("/login");
  if (!canAccessAdminPath(session.user.roles ?? [], "/admin/artikel")) {
    redirect(adminFallbackPath(session.user.roles ?? []));
  }

  const role = getPrimaryAdminRole(session.user.roles ?? []);
  const roleMode = role === "ADMIN_DOJO" ? "dojo" : "branch";

  const { data: rows, failed } = await withPrismaFallback(
    "admin-artikel-page",
    () =>
      prisma.articleEntry.findMany({
        orderBy: [{ order: "asc" }, { createdAt: "desc" }],
        take: 200,
      }),
    [],
  );

  const items: ArticleAdminItem[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    summary: r.summary,
    photoUrl: r.photoUrl,
    media: parseArticleMedia(r.media),
    publishedAt: r.publishedAt?.toISOString() ?? null,
    order: r.order,
    isActive: r.isActive,
    status:
      (r as { status?: ArticleAdminItem["status"] }).status ?? "PUBLISHED",
    authorName: (r as { authorName?: string | null }).authorName ?? null,
    authorDojoName:
      (r as { authorDojoName?: string | null }).authorDojoName ?? null,
    authorDojoId: (r as { authorDojoId?: string | null }).authorDojoId ?? null,
    rejectReason: (r as { rejectReason?: string | null }).rejectReason ?? null,
  }));

  return (
    <>
      <AdminPageHeader title="Artikel publik" />
      <p className="mb-6 text-sm text-muted-foreground">
        {roleMode === "dojo"
          ? "Setujui atau tolak kiriman anggota ranting Anda sebelum tampil di /artikel."
          : "Kelola berita/kegiatan publik dan antrean kiriman anggota. Setelah disetujui, tampil di /artikel dan beranda."}
      </p>
      <ArtikelManager
        initialItems={items}
        degraded={failed}
        roleMode={roleMode}
      />
    </>
  );
}
