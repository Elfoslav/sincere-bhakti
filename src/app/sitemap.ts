import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";

export default function sitemap(): MetadataRoute.Sitemap {
  const url = process.env.NEXTAUTH_URL || "https://sincere-bhakti.vercel.app";

  const staticPages = ["", "/posts"];

  const entries: MetadataRoute.Sitemap = [];

  for (const locale of routing.locales) {
    const prefix = locale === "en" ? "" : `/${locale}`;

    for (const page of staticPages) {
      entries.push({
        url: `${url}${prefix}${page}`,
        lastModified: new Date(),
        changeFrequency: "daily" as const,
        priority: page === "" ? 1.0 : 0.8,
        alternates: {
          languages: Object.fromEntries(
            routing.locales.map((l) => [
              l,
              `${url}${l === "en" ? "" : `/${l}`}${page}`,
            ]),
          ),
        },
      });
    }
  }

  return entries;
}
