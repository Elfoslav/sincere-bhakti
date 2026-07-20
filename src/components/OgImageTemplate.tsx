import { SITE_NAME } from "@/lib/seo";

export function OgImageTemplate({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  const titleLength = title.length;
  const titleFontSize = titleLength > 42 ? 58 : titleLength > 32 ? 66 : 76;

  return (
    <div
      style={{
        boxSizing: "border-box",
        display: "flex",
        width: "100%",
        height: "100%",
        background: "#fdf8ee",
        color: "#1a1a2e",
        padding: 72,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          border: "3px solid #d6a84f",
          padding: 56,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              display: "flex",
              fontSize: 30,
              letterSpacing: 4,
              textTransform: "uppercase",
              color: "#8a5f1f",
            }}
          >
            {eyebrow}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: titleFontSize,
              lineHeight: 1.05,
              fontWeight: 700,
              maxWidth: 940,
              overflowWrap: "anywhere",
              wordBreak: "break-word",
            }}
          >
            {title}
          </div>
          {subtitle && (
            <div
              style={{
                display: "flex",
                fontSize: 34,
                lineHeight: 1.25,
                color: "rgba(26, 26, 46, 0.68)",
                maxWidth: 880,
              }}
            >
              {subtitle}
            </div>
          )}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            color: "#8a5f1f",
            fontSize: 28,
          }}
        >
          <span>{SITE_NAME}</span>
        </div>
      </div>
    </div>
  );
}
