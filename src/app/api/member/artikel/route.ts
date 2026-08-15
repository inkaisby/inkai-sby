import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import {
  notifyArticlePendingAdmins,
} from "@/lib/article-notify";
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

const createSchema = z.object({
  title: z.string().trim().min(2).max(200),
  summary: z.string().trim().min(3).max(12000),
  photoUrl: z.string().url().optional().nullable().or(z.literal("")),
  media: mediaSchema,
  /** draft = DRAFT, submit = PENDING */
  intent: z.enum(["draft", "submit"]).default("submit"),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || !session.user.memberId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const items = await prisma.articleEntry.findMany({
      where: { authorUserId: session.user.id },
      orderBy: [{ updatedAt: "desc" }],
      take: 100,
    });
    return NextResponse.json(items);
  } catch (error) {
    console.error("[api/member/artikel GET]", error);
    return NextResponse.json([]);
  }
}

export async function POST(request: Request) {
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

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const member = await prisma.member.findFirst({
    where: { id: session.user.memberId, isDeleted: false },
    select: {
      id: true,
      fullName: true,
      dojoId: true,
      dojo: { select: { name: true } },
    },
  });
  if (!member?.dojoId) {
    return NextResponse.json(
      {
        error:
          "Profil anggota/ranting belum lengkap. Lengkapi profil sebelum menulis artikel.",
      },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const summary = normalizeSummaryText(data.summary);
  if (summary.length < 3 || summary.length > 12000) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const status = data.intent === "draft" ? "DRAFT" : "PENDING";

  if (status === "PENDING") {
    const pendingCount = await prisma.articleEntry.count({
      where: {
        authorUserId: session.user.id,
        status: "PENDING",
      },
    });
    if (pendingCount >= MAX_PENDING) {
      return NextResponse.json(
        {
          error: `Maksimal ${MAX_PENDING} artikel menunggu persetujuan. Tunggu review atau ubah yang sudah ada.`,
        },
        { status: 429 },
      );
    }
  }

  const mediaValue = normalizeMedia(data.media);

  try {
    const item = await prisma.articleEntry.create({
      data: {
        title: data.title,
        summary,
        photoUrl: data.photoUrl || null,
        ...(mediaValue !== undefined ? { media: mediaValue } : {}),
        status,
        isActive: true,
        order: 0,
        authorUserId: session.user.id,
        authorMemberId: member.id,
        authorDojoId: member.dojoId,
        authorName: member.fullName,
        authorDojoName: member.dojo?.name ?? null,
        publishedAt: null,
      },
    });

    if (status === "PENDING") {
      void notifyArticlePendingAdmins({
        dojoId: member.dojoId,
        title: "Artikel menunggu persetujuan",
        content: `${member.fullName} mengirim artikel «${item.title}».`,
        excludeUserId: session.user.id,
      });
    }

    revalidateTag("articles", "max");
    return NextResponse.json(
      {
        ...item,
        message:
          status === "DRAFT"
            ? "Draft artikel disimpan"
            : "Artikel dikirim, menunggu persetujuan",
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[api/member/artikel POST]", error);
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2021" || error.code === "P2022")
    ) {
      return NextResponse.json(
        { error: "Fitur artikel belum siap di database." },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: "Gagal menyimpan" }, { status: 500 });
  }
}
