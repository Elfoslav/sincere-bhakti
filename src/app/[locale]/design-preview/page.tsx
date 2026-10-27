import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { checkRateLimit, getClientIp, RATE_LIMITS, RATE_LIMIT_PREFIX } from "@/lib/rate-limit";
import { getNoIndexMetadata } from "@/lib/seo";
import { DESIGN_PALETTES, type DesignPalette } from "@/lib/design-palettes";
import PalettePreview from "./palette-preview";

export const metadata = getNoIndexMetadata("Palette preview");
export default async function DesignPreviewPage({ searchParams }: { searchParams: Promise<{ palette?: string; presentation?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const ip = getClientIp(await headers());
  if (!await checkRateLimit(RATE_LIMIT_PREFIX.readPosts, ip, RATE_LIMITS.readPosts.limit, RATE_LIMITS.readPosts.windowMs)) notFound();
  const { palette, presentation } = await searchParams;
  const selected = palette && Object.hasOwn(DESIGN_PALETTES, palette) ? palette as DesignPalette : "saffron";
  return <PalettePreview initialPalette={selected} presentation={presentation === "1"} />;
}
