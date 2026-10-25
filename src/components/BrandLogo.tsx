import Image from "next/image";
import { useTranslations } from "next-intl";

/**
 * The original logo, always uncropped and with its intrinsic aspect ratio.
 * The artwork's gold strokes measure only ~2.4:1 against the ivory canvas, so
 * a CSS filter deepens them to the brand brass (~5.7:1) without redrawing or
 * recoloring the mark itself.
 */
/** Deepens the logo's gold to ≥4.5:1 on the background (see the token contrast test). */
export const LOGO_CONTRAST_FILTER = "brightness(0.6) saturate(1.2)";

export default function BrandLogo({ size = "nav" }: { size?: "nav" | "display" }) {
  const t = useTranslations("Navbar");
  return (
    <Image
      src="/images/sincere-bhakti-logo.png"
      alt={t("logoAlt")}
      title={t("logoAlt")}
      width={595}
      height={397}
      preload={size === "nav"}
      className="shrink-0"
      style={{ width: size === "nav" ? 104 : 150, height: "auto", filter: LOGO_CONTRAST_FILTER }}
    />
  );
}
