import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/admin-auth";
import { canAccessAdminPath } from "@/lib/admin-page-access";
import { getManagedDojoIdsFromUser } from "@/lib/managed-dojos";
import { normalizeSummaryText } from "@/lib/polish-summary";
import { prisma } from "@/lib/prisma";
import { getPrimaryAdminRole } from "@/lib/rbac";
import { youtubeVideoId } from "@/lib/youtube";

const TABLE_MISSING_MSG =
  "Fitur artikel belum aktif. Tabel belum dibuat di database.";
const COLUMN_MISSING_MSG =
  "Kolom moderasi/media belum siap. Jalankan SQL article-moderation.sql / article-media.sql.";

function isTableMissing(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2021"
  );
}

function isColumnMissing(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2022"
  );
}

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
  publishedAt: z
    .string()
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform((v) => {
      if (!v) return null;
      const d = new Date(v);
      return Number.isFinite(d.getTime()) ? d.toISOString() : null;
    }),
  order: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export async function GET() {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (
    !canAccessAdminPath(
      authResult.user.roles ?? [],
      "/admin/artikel",
      authResult.adminDojoGrants,
    )
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const role = getPrimaryAdminRole(authResult.user.roles ?? []);
  const managed = getManagedDojoIdsFromUser(authResult.user);

  try {
    const items = await prisma.articleEntry.findMany({
      where:
        role === "ADMIN_DOJO"
          ? {
              OR: [
                { authorDojoId: { in: managed.length ? managed : ["__none__"] } },
                {
                  AND: [
                    { status: "PENDING" },
                    {
                      authorDojoId: {
                        in: managed.length ? managed : ["__none__"],
                      },
                    },
                  ],
                },
              ],
            }
          : undefined,
      orderBy: [{ status: "asc" }, { order: "asc" }, { createdAt: "desc" }],
      take: 200,
    });
    return NextResponse.json(items);
  } catch (error) {
    console.error("[api/admin/artikel GET]", error);
    return NextResponse.json([]);
  }
}

export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;
  if (
    !canAccessAdminPath(
      authResult.user.roles ?? [],
      "/admin/artikel",
      authResult.adminDojoGrants,
    )
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const role = getPrimaryAdminRole(authResult.user.roles ?? []);
  if (role === "ADMIN_DOJO") {
    return NextResponse.json(
      { error: "Ranting hanya dapat menyetujui/menolak kiriman anggota." },
      { status: 403 },
    );
  }

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const data = parsed.data;
  const summary = normalizeSummaryText(data.summary);
  if (summary.length < 3 || summary.length > 12000) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const mediaValue = normalizeMedia(data.media);

  try {
    const item = await prisma.articleEntry.create({
      data: {
        title: data.title,
        summary,
        photoUrl: data.photoUrl || null,
        ...(mediaValue !== undefined ? { media: mediaValue } : {}),
        publishedAt: data.publishedAt ? new Date(data.publishedAt) : new Date(),
        order: data.order,
        isActive: data.isActive,
        status: "PUBLISHED",
        reviewedByUserId: authResult.user.id,
        reviewedAt: new Date(),
      },
    });

    revalidateTag("articles", "max");
    return NextResponse.json(
      { ...item, message: "Artikel berhasil ditambahkan" },
      { status: 201 },
    );
  } catch (error) {
    console.error("[api/admin/artikel POST]", error);
    if (isTableMissing(error)) {
      return NextResponse.json({ error: TABLE_MISSING_MSG }, { status: 503 });
    }
    if (isColumnMissing(error)) {
      return NextResponse.json({ error: COLUMN_MISSING_MSG }, { status: 503 });
    }
    return NextResponse.json({ error: "Gagal menyimpan" }, { status: 500 });
  }
}
