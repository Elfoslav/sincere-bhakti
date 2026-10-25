import Image from "next/image";
import { useTranslations } from "next-intl";

/** The original logo, always uncropped and with its intrinsic aspect ratio. */
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
      style={{ width: size === "nav" ? 104 : 150, height: "auto" }}
    />
  );
}
