import { ImageResponse } from "next/og";
import { getCachedPostById } from "@/lib/services/post";
import { getSiteUrl } from "@/lib/url";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const mime = res.headers.get("content-type") || "image/png";
    return `data:${mime};base64,${base64}`;
  } catch {
    return null;
  }
}

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { id } = await params;
  const post = await getCachedPostById(id);

  const siteUrl = getSiteUrl();

  if (!post || !post.isPublic) {
    return new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            width: "100%",
            height: "100%",
            background: "linear-gradient(135deg, #1a1a2e 0%, #2d1b00 50%, #c8944a 100%)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <img
            src={`${siteUrl}/images/sincere-bhakti-logo.png`}
            alt="Sincere Bhakti"
            style={{ width: 400 }}
          />
        </div>
      ),
      { width: 1200, height: 630 },
    );
  }

  const firstImage = post.media.find((m) => m.type === "image" && m.url);
  const imageSrc = firstImage ? await fetchImageAsBase64(firstImage.url) : null;

  const content = post.content || "";
  const truncated = content.length > 150 ? content.slice(0, 147) + "..." : content;
  const channelName = post.channel?.name || "";

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #1a1a2e 0%, #2d1b00 50%, #c8944a 100%)",
          fontFamily: "system-ui, -apple-system, sans-serif",
          color: "white",
        }}
      >
        {imageSrc ? (
          <div
            style={{
              display: "flex",
              width: "50%",
              height: "100%",
              overflow: "hidden",
            }}
          >
            <img
              src={imageSrc}
              alt=""
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          </div>
        ) : null}

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "60px",
            width: imageSrc ? "50%" : "100%",
            height: "100%",
          }}
        >
          <div
            style={{
              fontSize: 40,
              fontWeight: 700,
              marginBottom: 20,
              lineHeight: 1.2,
              color: "white",
            }}
          >
            {truncated || "Sincere Bhakti"}
          </div>
          {channelName ? (
            <div
              style={{
                fontSize: 24,
                opacity: 0.8,
                marginBottom: 12,
                color: "#f0e6d3",
              }}
            >
              — {channelName}
            </div>
          ) : null}
          <div
            style={{
              fontSize: 18,
              opacity: 0.6,
              marginTop: "auto",
              color: "#d4c5a9",
            }}
          >
            🪷 Sincere Bhakti
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
