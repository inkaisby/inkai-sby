import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
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

  return routes.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : 0.7,
  }));
}
