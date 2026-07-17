import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    "",
    "/sejarah",
    "/makna-lambang",
    "/struktur",
    "/visi-misi",
    "/kontak",
    "/berita",
    "/kegiatan",
    "/dojo",
    "/keamanan-siber",
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
