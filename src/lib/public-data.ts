import { cache } from "react";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { SITE_BRANCH_NAME, SITE_PROVINCE_NAME } from "@/lib/site";
import { surabayaDojoWhere } from "@/lib/security/branch-scope";

export const getActiveNewsCarousel = unstable_cache(
  async () =>
    prisma.newsCarousel.findMany({
      where: { isActive: true },
      orderBy: { order: "asc" },
    }),
  ["active-news-carousel"],
  { revalidate: 60, tags: ["news-carousel"] }
);

export const getActiveNewsCarouselPreview = unstable_cache(
  async () =>
    prisma.newsCarousel.findMany({
      where: { isActive: true },
      orderBy: { order: "asc" },
      take: 8,
    }),
  ["active-news-carousel-preview"],
  { revalidate: 60, tags: ["news-carousel"] }
);

export const getBranchStructure = unstable_cache(
  async () =>
    prisma.branch.findFirst({
      where: {
        isDeleted: false,
        name: { equals: SITE_BRANCH_NAME, mode: "insensitive" },
        province: {
          isDeleted: false,
          name: { equals: SITE_PROVINCE_NAME, mode: "insensitive" },
        },
      },
      include: {
        province: true,
        dojos: {
          where: { isDeleted: false },
          include: { _count: { select: { members: true } } },
          orderBy: { name: "asc" },
        },
      },
    }),
  ["branch-structure"],
  { revalidate: 60, tags: ["branch", "dojo"] }
);

export const getUpcomingEvents = unstable_cache(
  async () => {
    const branch = await prisma.branch.findFirst({
      where: {
        name: { equals: SITE_BRANCH_NAME, mode: "insensitive" },
        isDeleted: false,
      },
    });

    return prisma.event.findMany({
      where: {
        isDeleted: false,
        ...(branch ? { branchId: branch.id } : {}),
        startDate: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { startDate: "asc" },
      take: 50,
    });
  },
  ["upcoming-events"],
  { revalidate: 60, tags: ["events"] }
);

const getDojoByIdCached = (id: string) =>
  unstable_cache(
    async () =>
      prisma.dojo.findFirst({
        where: { id, ...surabayaDojoWhere },
        include: {
          branch: true,
          _count: { select: { members: true } },
        },
      }),
    [`dojo-detail-${id}`],
    { revalidate: 60, tags: ["dojo", `dojo-${id}`] }
  )();

const getEventByIdCached = (id: string) =>
  unstable_cache(
    async () =>
      prisma.event.findFirst({
        where: { id, isDeleted: false },
        include: { categories: true },
      }),
    [`event-detail-${id}`],
    { revalidate: 60, tags: ["events", `event-${id}`] }
  )();

export const getDojoDetail = cache((id: string) => getDojoByIdCached(id));

export const getEventDetail = cache((id: string) => getEventByIdCached(id));
