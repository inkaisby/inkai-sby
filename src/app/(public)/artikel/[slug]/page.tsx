import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ArtikelPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await prisma.article.findUnique({ where: { slug } });

  if (!article || !article.published) notFound();

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-inkai-red"
      >
        <ArrowLeft className="h-4 w-4" />
        Kembali ke Beranda
      </Link>

      <Badge className="mb-4 bg-inkai-red/10 text-inkai-red hover:bg-inkai-red/10">
        Artikel
      </Badge>
      <h1 className="mb-4 text-3xl font-bold sm:text-4xl">{article.title}</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        {new Date(article.createdAt).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
      </p>

      {article.imageUrl && (
        <div className="relative mb-8 h-64 overflow-hidden rounded-2xl bg-gradient-to-br from-inkai-red/10 to-inkai-yellow/10">
          <Image
            src={article.imageUrl}
            alt={article.title}
            fill
            className="object-contain p-8"
          />
        </div>
      )}

      <div className="prose prose-neutral max-w-none">
        <p className="text-lg leading-relaxed text-muted-foreground">
          {article.content}
        </p>
      </div>
    </article>
  );
}
