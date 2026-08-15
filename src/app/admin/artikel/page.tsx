import { Suspense } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { canAccessAdmin } from "@/lib/rbac";
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

  const { data: rows, failed } = await withPrismaFallback(
    "admin-artikel-page",
    () =>
      prisma.articleEntry.findMany({
        orderBy: [{ order: "asc" }, { createdAt: "desc" }],
        take: 200,
        select: {
          id: true,
          title: true,
          summary: true,
          photoUrl: true,
          media: true,
          publishedAt: true,
          order: true,
          isActive: true,
        },
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
  }));

  return (
    <>
      <AdminPageHeader title="Artikel publik" />
      <p className="mb-6 text-sm text-muted-foreground">
        Kelola berita dan kegiatan untuk halaman publik /artikel serta cuplikan
        beranda (Artikel Terbaru).
      </p>
      <ArtikelManager initialItems={items} degraded={failed} />
    </>
  );
}
