import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma, withPrismaFallback } from "@/lib/prisma";
import { MemberPageHeader } from "@/components/member/MemberPageHeader";
import { BookOpen, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function MateriPage() {
  const session = await auth();
  if (!session?.user.memberId) redirect("/login");

  const result = await withPrismaFallback(
    "materi-page",
    () =>
      prisma.digitalMaterial.findMany({
        where: { isPublished: true },
        orderBy: { createdAt: "desc" },
      }),
    [],
  );
  const materials = result.data;

  return (
    <>
      <MemberPageHeader title="Materi Digital" />
      <p className="mb-4 text-sm text-muted-foreground">
        Materi latihan dan dokumen resmi dari cabang.
      </p>

      {materials.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Belum ada materi dipublikasikan.
        </div>
      ) : (
        <div className="space-y-3">
          {materials.map((m) => (
            <div
              key={m.id}
              className="rounded-2xl border border-border/60 bg-card p-4"
            >
              <div className="mb-2 flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-inkai-red/10 text-inkai-red">
                  <BookOpen size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{m.title}</p>
                  {m.category ? (
                    <Badge variant="secondary" className="mt-1">
                      {m.category}
                    </Badge>
                  ) : null}
                  {m.description ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {m.description}
                    </p>
                  ) : null}
                </div>
              </div>
              <a
                href={m.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-inkai-red hover:underline"
              >
                Buka materi <ExternalLink size={14} />
              </a>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
