import { cache } from "react";
import { unstable_cache } from "next/cache";
import { inkaiFetch } from "@/lib/inkai-api/server";
import { SITE_BRANCH_NAME, SITE_PROVINCE_NAME } from "@/lib/site";

export type CarouselItem = {
  id: string;
  title: string;
  imageUrl: string;
  targetUrl: string | null;
  order: number;
  isActive: boolean;
  createdAt?: string;
};

export type PublicDojoDetail = {
  id: string;
  name: string;
  headName: string | null;
  address: string | null;
  kecamatan: string | null;
  phoneNumber: string | null;
  schedule: string | null;
  tempatLatihan: string | null;
  branch: { id: string; name: string };
  _count: { members: number };
};

export type PublicEventDetail = {
  id: string;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string | null;
  location: string | null;
  categories: Array<{ id: string; name: string; fee: number }>;
};

export type PublicEventSummary = {
  id: string;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string | null;
  location: string | null;
};

export type PublicBranchStructure = {
  id: string;
  name: string;
  headName: string | null;
  city: string | null;
  province: { id: string; name: string; headName?: string | null };
  dojos: Array<{
    id: string;
    name: string;
    address: string | null;
    headName: string | null;
    kecamatan: string | null;
    _count: { members: number };
  }>;
};

function mapDojoDetail(raw: Record<string, unknown>): PublicDojoDetail {
  const branch = raw.branch as Record<string, unknown> | undefined;
  return {
    id: String(raw.id),
    name: String(raw.name ?? ""),
    headName: (raw.headName as string | null) ?? null,
    address: (raw.address as string | null) ?? null,
    kecamatan: (raw.kecamatan as string | null) ?? null,
    phoneNumber: (raw.phoneNumber as string | null) ?? null,
    schedule: (raw.schedule as string | null) ?? null,
    tempatLatihan: (raw.tempatLatihan as string | null) ?? null,
    branch: {
      id: String(branch?.id ?? ""),
      name: String(branch?.name ?? ""),
    },
    _count: {
      members: (raw._count as { members?: number })?.members ?? 0,
    },
  };
}

function mapEventDetail(raw: Record<string, unknown>): PublicEventDetail {
  const categories = (raw.categories as Array<Record<string, unknown>>) ?? [];
  return {
    id: String(raw.id),
    title: String(raw.title ?? ""),
    description: (raw.description as string | null) ?? null,
    startDate: String(raw.startDate),
    endDate: raw.endDate ? String(raw.endDate) : null,
    location: (raw.location as string | null) ?? null,
    categories: categories.map((c) => ({
      id: String(c.id),
      name: String(c.name ?? ""),
      fee: Number(c.fee ?? 0),
    })),
  };
}

function mapEventSummary(raw: Record<string, unknown>): PublicEventSummary {
  return {
    id: String(raw.id),
    title: String(raw.title ?? ""),
    description: (raw.description as string | null) ?? null,
    startDate: String(raw.startDate),
    endDate: raw.endDate ? String(raw.endDate) : null,
    location: (raw.location as string | null) ?? null,
  };
}

async function fetchCarousel(activeOnly: boolean, limit?: number): Promise<CarouselItem[]> {
  const { res, data } = await inkaiFetch("/v1/news-carousel", {}, null);
  if (!res.ok) return [];
  let items = ((data.data as Array<Record<string, unknown>>) ?? []).map((i) => ({
    id: String(i.id),
    title: String(i.title ?? ""),
    imageUrl: String(i.imageUrl ?? ""),
    targetUrl: (i.targetUrl as string | null) ?? null,
    order: Number(i.order ?? 0),
    isActive: i.isActive === true,
    createdAt: i.createdAt ? String(i.createdAt) : undefined,
  }));
  if (activeOnly) items = items.filter((i) => i.isActive);
  items.sort((a, b) => a.order - b.order);
  if (limit) items = items.slice(0, limit);
  return items;
}

export const getActiveNewsCarousel = unstable_cache(
  async () => fetchCarousel(true),
  ["active-news-carousel"],
  { revalidate: 60, tags: ["news-carousel"] },
);

export const getActiveNewsCarouselPreview = unstable_cache(
  async () => fetchCarousel(true, 8),
  ["active-news-carousel-preview"],
  { revalidate: 60, tags: ["news-carousel"] },
);

async function fetchBranchStructure(): Promise<PublicBranchStructure | null> {
  const { res, data } = await inkaiFetch("/v1/org/provinces", {}, null);
  if (!res.ok) return null;

  const provinces = (data.data as Array<Record<string, unknown>>) ?? [];
  const province = provinces.find(
    (p) => String(p.name).toUpperCase() === SITE_PROVINCE_NAME.toUpperCase(),
  );
  if (!province) return null;

  const branches = (province.branches as Array<Record<string, unknown>>) ?? [];
  const branch = branches.find(
    (b) => String(b.name).toUpperCase() === SITE_BRANCH_NAME.toUpperCase(),
  );
  if (!branch) return null;

  return {
    id: String(branch.id),
    name: String(branch.name ?? ""),
    headName: (branch.headName as string | null) ?? null,
    city: (branch.city as string | null) ?? null,
    province: {
      id: String(province.id),
      name: String(province.name ?? ""),
      headName: (province.headName as string | null) ?? null,
    },
    dojos: ((branch.dojos as Array<Record<string, unknown>>) ?? []).map((d) => ({
      id: String(d.id),
      name: String(d.name ?? ""),
      address: (d.address as string | null) ?? null,
      headName: (d.headName as string | null) ?? null,
      kecamatan: (d.kecamatan as string | null) ?? null,
      _count: { members: (d._count as { members?: number })?.members ?? 0 },
    })),
  };
}

export const getBranchStructure = unstable_cache(
  async () => fetchBranchStructure(),
  ["branch-structure"],
  { revalidate: 60, tags: ["branch", "dojo"] },
);

export const getUpcomingEvents = unstable_cache(
  async (): Promise<PublicEventSummary[]> => {
    const { res, data } = await inkaiFetch("/v1/events", {}, null);
    if (!res.ok) return [];

    const branch = await fetchBranchStructure();
    const branchId = branch?.id;
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;

    const events = (data.data as Array<Record<string, unknown>>) ?? [];
    return events
      .filter((e) => {
        if (branchId && e.branchId !== branchId) return false;
        return new Date(String(e.startDate)).getTime() >= cutoff;
      })
      .sort((a, b) => new Date(String(a.startDate)).getTime() - new Date(String(b.startDate)).getTime())
      .slice(0, 50)
      .map(mapEventSummary);
  },
  ["upcoming-events"],
  { revalidate: 60, tags: ["events"] },
);

const getDojoByIdCached = (id: string) =>
  unstable_cache(
    async (): Promise<PublicDojoDetail | null> => {
      const { res, data } = await inkaiFetch(`/v1/org/dojo/${id}`, {}, null);
      if (!res.ok) return null;
      const dojo = (data.data as Record<string, unknown>) ?? null;
      if (!dojo) return null;
      const branch = dojo.branch as Record<string, unknown> | undefined;
      if (
        branch &&
        String(branch.name).toUpperCase() !== SITE_BRANCH_NAME.toUpperCase()
      ) {
        return null;
      }
      return mapDojoDetail(dojo);
    },
    [`dojo-detail-${id}`],
    { revalidate: 60, tags: ["dojo", `dojo-${id}`] },
  )();

const getEventByIdCached = (id: string) =>
  unstable_cache(
    async (): Promise<PublicEventDetail | null> => {
      const { res, data } = await inkaiFetch(`/v1/events/${id}`, {}, null);
      if (!res.ok) return null;
      const event = (data.data as Record<string, unknown>) ?? null;
      return event ? mapEventDetail(event) : null;
    },
    [`event-detail-${id}`],
    { revalidate: 60, tags: ["events", `event-${id}`] },
  )();

export const getDojoDetail = cache((id: string) => getDojoByIdCached(id));

export const getEventDetail = cache((id: string) => getEventByIdCached(id));
