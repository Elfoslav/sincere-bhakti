import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { getSiteUrl } from "@/lib/url";

export default function robots(): MetadataRoute.Robots {
  const url = getSiteUrl();
  const privatePaths = [
    "/api/",
    "/e2e/",
    "/login",
    "/register",
    "/profile/settings",
    "/channels/*/settings",
  ];
  const localizedPrivatePaths = routing.locales.flatMap((locale) => {
    const prefix = locale === "en" ? "" : `/${locale}`;
    return privatePaths.map((path) => `${prefix}${path}`);
  });

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: localizedPrivatePaths,
    },
    sitemap: `${url}/sitemap.xml`,
  };
}
