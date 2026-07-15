import { ImageResponse } from "next/og";
import sharp from "sharp";
import { getCachedPostById } from "@/lib/services/post";
import { getSiteUrl } from "@/lib/url";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

async function fetchImageAsPngBase64(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    const ct = res.headers.get("content-type") || "";
    // Satori only supports PNG/JPEG. Convert WebP and other formats to PNG.
    if (ct === "image/webp" || !ct.startsWith("image/")) {
      const png = await sharp(buffer).png().toBuffer();
      return `data:image/png;base64,${png.toString("base64")}`;
    }
    return `data:${ct};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

function logoFallback(siteUrl: string) {
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        // Warm ivory: the logo is dark-ink-on-transparent (its light-background
        // variant), so a light brand-colored ground gives it full contrast.
        background: "#fdf8ee",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Fill the 1200×630 canvas with the logo, leaving a small margin:
          550px tall at the logo's exact 603×414 aspect ratio → 801px wide. */}
      <img
        src={`${siteUrl}/images/sincere-bhakti-logo.png`}
        alt="Sincere Bhakti"
        width={801}
        height={550}
      />
    </div>,
    { width: 1200, height: 630 },
  );
}

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { id } = await params;
  const post = await getCachedPostById(id);

  const siteUrl = getSiteUrl();

  // Post image available: show it full-bleed with nothing layered on top.
  // Otherwise (no post, private, no image, or fetch failed): logo fallback.
  // Prefer a landscape image — the 1200×630 cover crop cuts it the least.
  const images =
    post && post.isPublic ? post.media.filter((m) => m.type === "image" && m.url) : [];
  const bestImage =
    images.find((m) => m.width && m.height && m.width >= m.height) ?? images[0] ?? null;
  const imageSrc = bestImage ? await fetchImageAsPngBase64(bestImage.url) : null;

  if (!imageSrc) {
    return logoFallback(siteUrl);
  }

  return new ImageResponse(
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        background: "#1a1a2e",
      }}
    >
      <img
        src={imageSrc}
        alt=""
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    </div>,
    { width: 1200, height: 630 },
  );
}
