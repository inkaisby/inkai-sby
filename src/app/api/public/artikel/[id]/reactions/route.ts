import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import {
  ARTICLE_REACTION_EMOJIS,
  attachVisitorCookie,
  emptyReactionCounts,
  isArticleReactionEmoji,
  resolveArticleVisitorId,
  type ArticleReactionCounts,
  type ArticleReactionEmoji,
} from "@/lib/article-reactions";
import { prisma } from "@/lib/prisma";
import { rateLimitAsync, rateLimitResponse } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/request";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const postSchema = z.object({
  emoji: z.enum(
    ARTICLE_REACTION_EMOJIS as unknown as [
      ArticleReactionEmoji,
      ...ArticleReactionEmoji[],
    ],
  ),
});

function isMissingTableOrColumn(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" || error.code === "P2022")
  );
}

async function assertActiveArticle(id: string): Promise<boolean> {
  const row = await prisma.articleEntry.findFirst({
    where: { id, isActive: true },
    select: { id: true },
  });
  return Boolean(row);
}

async function loadCounts(articleId: string): Promise<ArticleReactionCounts> {
  const counts = emptyReactionCounts();
  const grouped = await prisma.articleReaction.groupBy({
    by: ["emoji"],
    where: { articleId },
    _count: { _all: true },
  });
  for (const row of grouped) {
    if (isArticleReactionEmoji(row.emoji)) {
      counts[row.emoji] = row._count._all;
    }
  }
  return counts;
}

function jsonWithVisitor(
  body: unknown,
  visitorId: string,
  isNew: boolean,
  init?: ResponseInit,
) {
  const res = NextResponse.json(body, init);
  if (isNew) attachVisitorCookie(res, visitorId);
  return res;
}

export async function GET(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const { visitorId, isNew } = await resolveArticleVisitorId();

  try {
    const active = await assertActiveArticle(id);
    if (!active) {
      return jsonWithVisitor(
        { error: "Artikel tidak ditemukan" },
        visitorId,
        isNew,
        { status: 404 },
      );
    }

    const [counts, mineRow] = await Promise.all([
      loadCounts(id),
      prisma.articleReaction.findUnique({
        where: {
          articleId_visitorId: { articleId: id, visitorId },
        },
        select: { emoji: true },
      }),
    ]);

    const mine =
      mineRow && isArticleReactionEmoji(mineRow.emoji) ? mineRow.emoji : null;

    return jsonWithVisitor({ counts, mine }, visitorId, isNew);
  } catch (error) {
    if (isMissingTableOrColumn(error)) {
      return jsonWithVisitor(
        { counts: emptyReactionCounts(), mine: null },
        visitorId,
        isNew,
      );
    }
    console.error("[api/public/artikel/reactions GET]", error);
    return jsonWithVisitor(
      { error: "Gagal memuat reaksi" },
      visitorId,
      isNew,
      { status: 500 },
    );
  }
}

export async function POST(request: Request, ctx: Ctx) {
  const ip = getClientIp(request);
  const limited = await rateLimitAsync(`artikel-react:${ip}`, {
    max: 30,
    windowMs: 60_000,
  });
  if (!limited.success) {
    return rateLimitResponse(limited.retryAfterSec ?? 60);
  }

  const { id } = await ctx.params;
  const { visitorId, isNew } = await resolveArticleVisitorId();

  const parsed = postSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonWithVisitor({ error: "Data tidak valid" }, visitorId, isNew, {
      status: 400,
    });
  }

  const emoji = parsed.data.emoji;

  try {
    const active = await assertActiveArticle(id);
    if (!active) {
      return jsonWithVisitor(
        { error: "Artikel tidak ditemukan" },
        visitorId,
        isNew,
        { status: 404 },
      );
    }

    const existing = await prisma.articleReaction.findUnique({
      where: {
        articleId_visitorId: { articleId: id, visitorId },
      },
      select: { id: true, emoji: true },
    });

    let mine: ArticleReactionEmoji | null;

    if (existing && existing.emoji === emoji) {
      await prisma.articleReaction.delete({ where: { id: existing.id } });
      mine = null;
    } else if (existing) {
      await prisma.articleReaction.update({
        where: { id: existing.id },
        data: { emoji },
      });
      mine = emoji;
    } else {
      await prisma.articleReaction.create({
        data: { articleId: id, visitorId, emoji },
      });
      mine = emoji;
    }

    const counts = await loadCounts(id);
    return jsonWithVisitor({ counts, mine }, visitorId, isNew);
  } catch (error) {
    if (isMissingTableOrColumn(error)) {
      return jsonWithVisitor(
        {
          error:
            "Fitur reaksi belum aktif. Tabel belum dibuat di database.",
        },
        visitorId,
        isNew,
        { status: 503 },
      );
    }
    console.error("[api/public/artikel/reactions POST]", error);
    return jsonWithVisitor(
      { error: "Gagal menyimpan reaksi" },
      visitorId,
      isNew,
      { status: 500 },
    );
  }
}
