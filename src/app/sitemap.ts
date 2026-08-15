import type { MetadataRoute } from "next";
import { listActiveArticles, articlePublicPath } from "@/lib/articles";
import { SITE_URL } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const routes = [
    "",
    "/tutorial",
    "/sejarah",
    "/makna-lambang",
    "/struktur",
    "/visi-misi",
    "/kontak",
    "/apresiasi",
    "/artikel",
    "/kegiatan",
    "/dojo",
    "/keamanan-siber",
    "/latber",
    "/login",
    "/daftar",
  ];

  const staticEntries: MetadataRoute.Sitemap = routes.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : 0.7,
  }));

  const articles = await listActiveArticles();
  const articleEntries: MetadataRoute.Sitemap = articles.map((item) => ({
    url: `${SITE_URL}${articlePublicPath(item)}`,
    lastModified: item.publishedAt
      ? new Date(item.publishedAt)
      : new Date(),
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [...staticEntries, ...articleEntries];
}
