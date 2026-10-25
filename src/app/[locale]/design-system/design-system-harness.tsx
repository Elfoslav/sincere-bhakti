"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import BrandLogo from "@/components/BrandLogo";
import { ArrowRight, Pencil } from "lucide-react";
import { DESIGN_COLOR_TOKENS, DESIGN_SPACING_STEPS } from "@/lib/design-system";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { TabsRoot, TabsList, TabsTab, TabsPanel } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTrigger } from "@/components/ui/dialog";

export default function DesignSystemHarness() {
  const t = useTranslations("DesignSystem");
  const home = useTranslations("HomePage");
  const [checked, setChecked] = useState(false);

  return (
    <div className="site-container section-space flex flex-col gap-12">
      <header className="flex flex-col gap-4">
        <BrandLogo size="display" />
        <h1 className="type-title">{t("title")}</h1>
        <p className="max-w-2xl text-muted-foreground leading-relaxed">{t("description")}</p>
      </header>
      <TabsRoot defaultValue="foundations">
        <TabsList>
          <TabsTab value="foundations">{t("foundations")}</TabsTab>
          <TabsTab value="components">{t("components")}</TabsTab>
        </TabsList>
        <TabsPanel value="foundations" className="flex flex-col gap-12 pt-6">
          <section className="flex flex-col gap-5">
            <h2 className="type-section">{t("palette")}</h2>
            <p className="text-muted-foreground">{t("paletteDescription")}</p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {DESIGN_COLOR_TOKENS.map((token) => (
                <div key={token} className="overflow-hidden rounded-lg border border-border bg-card">
                  <div className="h-20 border-b border-border" style={{ backgroundColor: `var(--${token})` }} />
                  <code className="block px-3 py-3 text-xs">--{token}</code>
                </div>
              ))}
            </div>
          </section>
          <section className="flex flex-col gap-5">
            <h2 className="type-section">{t("typography")}</h2>
            <p className="text-muted-foreground">{t("typographyDescription")}</p>
            <div className="flex flex-col gap-5 border-y border-border py-8">
              <p className="font-heading type-display">{home("logoAlt")}</p>
              <p className="font-heading type-title">{home("subtitle")}</p>
              <p className="font-heading type-section">{home("cardBhaktiTitle")}</p>
              <p className="max-w-xl text-base leading-relaxed">{home("description")}</p>
              <p className="text-sm text-muted-foreground">{t("caption")}</p>
            </div>
          </section>
          <section className="flex flex-col gap-5">
            <h2 className="type-section">{t("spacing")}</h2>
            <p className="text-muted-foreground">{t("spacingDescription")}</p>
            {DESIGN_SPACING_STEPS.map((step) => (
              <div key={step} className="flex items-center gap-4">
                <code className="w-12 text-xs">{step * 4}px</code>
                <div className="h-3 rounded-sm bg-primary" style={{ width: `calc(var(--spacing) * ${step})` }} />
              </div>
            ))}
          </section>
          <section className="flex flex-col gap-4">
            <h2 className="type-section">{t("principles")}</h2>
            <p className="max-w-2xl text-muted-foreground leading-relaxed">{t("principlesDescription")}</p>
          </section>
        </TabsPanel>
        <TabsPanel value="components" className="flex flex-col gap-12 pt-6">
          <section className="flex flex-col gap-5">
            <h2 className="type-section">{t("actions")}</h2>
            <div className="flex flex-wrap items-center gap-4">
              <Button>{t("primary")}</Button>
              <Button variant="outline">{t("secondary")}</Button>
              <Button variant="ghost">{t("quiet")}</Button>
              <Button variant="destructive">{t("delete")}</Button>
              <Button disabled>{t("disabled")}</Button>
              <Button variant="link" icon={<ArrowRight />} iconPosition="end">{t("readMore")}</Button>
              <Button icon={<Pencil />} aria-label={t("edit")} />
            </div>
          </section>
          <section className="flex flex-col gap-5">
            <h2 className="type-section">{t("surfaces")}</h2>
            <div className="grid gap-6 sm:grid-cols-3">
              <Card><h3 className="text-xl">{t("surface")}</h3><p className="mt-3 text-sm text-muted-foreground">{t("surfaceDescription")}</p></Card>
              <Card variant="elevated"><h3 className="text-xl">{t("elevated")}</h3><p className="mt-3 text-sm text-muted-foreground">{t("elevatedDescription")}</p></Card>
              <Card variant="editorial" className="py-5"><h3 className="text-xl">{t("editorial")}</h3><p className="mt-3 text-sm text-muted-foreground">{t("editorialDescription")}</p></Card>
            </div>
          </section>
          <section className="flex max-w-xl flex-col gap-5">
            <h2 className="type-section">{t("forms")}</h2>
            <label className="flex flex-col gap-2 text-sm">{t("name")}<Input placeholder={t("placeholder")} /></label>
            <label className="flex flex-col gap-2 text-sm">{t("invalid")}<Input aria-invalid errorMessage={t("required")} /></label>
            <label className="flex flex-col gap-2 text-sm">{t("disabled")}<Input disabled placeholder={t("placeholder")} /></label>
            <label className="flex flex-col gap-2 text-sm">{t("reflection")}<Textarea placeholder={t("placeholder")} /></label>
            <div className="flex items-center gap-3"><Switch id="design-switch" checked={checked} onCheckedChange={setChecked} /><label htmlFor="design-switch" className="text-sm">{t("public")}</label></div>
          </section>
          <section className="flex max-w-xl flex-col gap-5">
            <h2 className="type-section">{t("feedback")}</h2>
            <Alert variant="success">{t("success")}</Alert>
            <Alert variant="destructive">{t("error")}</Alert>
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </section>
          <Dialog>
            <DialogTrigger render={<Button variant="outline">{t("openDialog")}</Button>} />
            <DialogContent>
              <DialogHeader text={t("dialogTitle")} subheading={t("dialogDescription")} />
              <DialogFooter><Button>{t("primary")}</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsPanel>
      </TabsRoot>
    </div>
  );
}
