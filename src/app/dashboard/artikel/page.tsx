import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { MemberPageHeader } from "@/components/member/MemberPageHeader";
import {
  MemberArtikelManager,
  type MemberArticleItem,
} from "@/app/dashboard/artikel/MemberArtikelManager";
import { parseArticleMedia } from "@/lib/articles";
import { prisma, withPrismaFallback } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function DashboardArtikelPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.memberId) redirect("/login");

  const { data: rows } = await withPrismaFallback(
    "member-artikel-list",
    () =>
      prisma.articleEntry.findMany({
        where: { authorUserId: session.user.id },
        orderBy: [{ updatedAt: "desc" }],
        take: 100,
      }),
    [],
  );

  const initialItems: MemberArticleItem[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    summary: row.summary,
    photoUrl: row.photoUrl,
    media: parseArticleMedia(row.media),
    status: (row as { status?: MemberArticleItem["status"] }).status ?? "DRAFT",
    rejectReason:
      (row as { rejectReason?: string | null }).rejectReason ?? null,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
  }));

  return (
    <>
      <MemberPageHeader title="Artikel" />
      <p className="mb-4 text-sm text-muted-foreground">
        Tulis berita atau kegiatan. Setelah ranting/cabang menyetujui, artikel
        tampil di halaman publik /artikel.
      </p>
      <MemberArtikelManager
        initialItems={initialItems}
        hasMemberProfile={Boolean(session.user.memberId)}
      />
    </>
  );
}
