"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HomeHero({ headingLevel = "h1" }: { headingLevel?: "h1" | "h2" }) {
  const t = useTranslations("HomePage");
  const Title = headingLevel;
  return (
<section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero-media">
          <Image src="/images/vrindavan-dawn.jpg" alt="" fill sizes="100vw" preload />
        </div>
        <div className="site-container home-hero-content">
          <div className="home-hero-copy reveal-in">
            <Title id="home-title" className="type-display">{t("logoAlt")}</Title>
            <p className="font-heading home-hero-subtitle mt-4">{t("subtitle")}</p>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-foreground sm:text-lg">{t("heroDescription")}</p>
            <div className="mt-8 flex flex-wrap items-center gap-4 sm:gap-6">
              <Button href="/posts" size="hero" icon={<ArrowRight />} iconPosition="end">{t("ctaPosts")}</Button>
              <Button href="/register" variant="link" className="text-foreground font-normal">{t("ctaJoin")}</Button>
            </div>
          </div>
        </div>
      </section>
  );
}
