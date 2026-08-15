import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { notifyArticlePendingAdmins } from "@/lib/article-notify";
import { normalizeSummaryText } from "@/lib/polish-summary";
import { prisma } from "@/lib/prisma";
import { rateLimitAsync, rateLimitResponse } from "@/lib/security/rate-limit";
import { youtubeVideoId } from "@/lib/youtube";

const MAX_PENDING = 5;

const mediaItemSchema = z
  .object({
    type: z.enum(["IMAGE", "VIDEO"]),
    url: z.string().trim().url().max(2000),
    caption: z.string().trim().max(200).optional().or(z.literal("")),
  })
  .superRefine((val, ctx) => {
    if (val.type === "VIDEO" && !youtubeVideoId(val.url)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "URL video harus dari YouTube",
        path: ["url"],
      });
    }
  });

const mediaSchema = z.array(mediaItemSchema).max(20).optional().nullable();

function normalizeMedia(
  media: z.infer<typeof mediaSchema> | undefined,
): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
  if (media === undefined) return undefined;
  if (media == null || media.length === 0) return Prisma.JsonNull;
  return media.map((m) => ({
    type: m.type,
    url: m.url,
    ...(m.caption ? { caption: m.caption } : {}),
  }));
}

const updateSchema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  summary: z.string().trim().min(3).max(12000).optional(),
  photoUrl: z.string().url().optional().nullable().or(z.literal("")),
  media: mediaSchema,
  intent: z.enum(["draft", "submit"]).optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id || !session.user.memberId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await rateLimitAsync(
    `member-artikel-write:${session.user.id}`,
    { max: 10, windowMs: 60 * 60 * 1000 },
  );
  if (!limited.success) {
    return rateLimitResponse(limited.retryAfterSec ?? 60);
  }

  const { id } = await ctx.params;
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const existing = await prisma.articleEntry.findFirst({
    where: { id, authorUserId: session.user.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });
  }

  const d = parsed.data;
  let summary: string | undefined;
  if (d.summary !== undefined) {
    summary = normalizeSummaryText(d.summary);
    if (summary.length < 3 || summary.length > 12000) {
      return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
    }
  }

  const mediaValue = normalizeMedia(d.media);
  const wasPublished = existing.status === "PUBLISHED";
  let nextStatus = existing.status;

  if (d.intent === "draft") {
    nextStatus = "DRAFT";
  } else if (d.intent === "submit" || wasPublished) {
    nextStatus = "PENDING";
  }

  if (nextStatus === "PENDING" && existing.status !== "PENDING") {
    const pendingCount = await prisma.articleEntry.count({
      where: {
        authorUserId: session.user.id,
        status: "PENDING",
        NOT: { id },
      },
    });
    if (pendingCount >= MAX_PENDING) {
      return NextResponse.json(
        {
          error: `Maksimal ${MAX_PENDING} artikel menunggu persetujuan.`,
        },
        { status: 429 },
      );
    }
  }

  const clearReview = nextStatus === "PENDING" || nextStatus === "DRAFT";

  try {
    const item = await prisma.articleEntry.update({
      where: { id },
      data: {
        ...(d.title !== undefined ? { title: d.title } : {}),
        ...(summary !== undefined ? { summary } : {}),
        ...(d.photoUrl !== undefined ? { photoUrl: d.photoUrl || null } : {}),
        ...(mediaValue !== undefined ? { media: mediaValue } : {}),
        status: nextStatus,
        ...(clearReview
          ? {
              reviewedAt: null,
              reviewedByUserId: null,
              rejectReason: null,
              publishedAt: nextStatus === "PENDING" ? null : existing.publishedAt,
            }
          : {}),
      },
    });

    if (nextStatus === "PENDING" && existing.authorDojoId) {
      void notifyArticlePendingAdmins({
        dojoId: existing.authorDojoId,
        title: wasPublished
          ? "Artikel diedit — tinjau ulang"
          : "Artikel menunggu persetujuan",
        content: `${existing.authorName ?? "Anggota"} ${wasPublished ? "mengedit" : "mengirim"} artikel «${item.title}».`,
        excludeUserId: session.user.id,
      });
    }

    revalidateTag("articles", "max");
    return NextResponse.json({
      ...item,
      message:
        nextStatus === "PENDING"
          ? wasPublished
            ? "Perubahan dikirim; artikel menunggu persetujuan ulang"
            : "Artikel dikirim, menunggu persetujuan"
          : "Draft disimpan",
      remoderating: wasPublished && nextStatus === "PENDING",
    });
  } catch (error) {
    console.error("[api/member/artikel PATCH]", error);
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2022"
    ) {
      return NextResponse.json(
        { error: "Kolom moderasi belum siap. Jalankan SQL article-moderation.sql." },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: "Gagal memperbarui" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id || !session.user.memberId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const existing = await prisma.articleEntry.findFirst({
    where: { id, authorUserId: session.user.id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });
  }

  try {
    await prisma.articleEntry.delete({ where: { id } });
    revalidateTag("articles", "max");
    return NextResponse.json({ message: "Artikel dihapus" });
  } catch {
    return NextResponse.json({ error: "Gagal menghapus" }, { status: 500 });
  }
}
