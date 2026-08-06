"use client";

import { useState } from "react";
import { Mail, Pencil, Trash2, Star } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Heading } from "@/components/ui/heading";
import { InfoBox } from "@/components/ui/info-box";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { TabsPanel, TabsRoot, TabsList, TabsTab } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

function VariantGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

const brandColors = [
  { name: "deep", hex: "#1a1a2e", text: "white" },
  { name: "gold", hex: "#d4a843", text: "white" },
  { name: "gold-light", hex: "#e8c36a", text: "deep" },
  { name: "saffron", hex: "#e08a2e", text: "white" },
  { name: "saffron-dark", hex: "#c87427", text: "white" },
  { name: "brass", hex: "#b8862b", text: "white" },
  { name: "warm", hex: "#f5f7fa", text: "deep" },
  { name: "sand", hex: "#e8dcc8", text: "deep" },
  { name: "tulsi", hex: "#2e6b4f", text: "white" },
];

const semanticColors = [
  { name: "background", hex: "#f5f7fa", text: "deep" },
  { name: "foreground", hex: "#1a1a2e", text: "white" },
  { name: "card", hex: "#ffffff", text: "deep" },
  { name: "primary", hex: "#e08a2e", text: "white" },
  { name: "secondary", hex: "#e8dcc8", text: "deep" },
  { name: "muted", hex: "#eaeef4", text: "deep" },
  { name: "accent", hex: "#d4a843", text: "deep" },
  { name: "destructive", hex: "#e74c3c", text: "white" },
  { name: "border", hex: "#e8dcc8", text: "deep" },
  { name: "ring", hex: "#d4a843", text: "deep" },
];

function ColorSwatch({ name, hex, text }: { name: string; hex: string; text: string }) {
  return (
    <div className="flex w-36 flex-col overflow-hidden rounded-xl border border-sand shadow-sm">
      <div
        className="flex h-20 items-end p-2"
        style={{ backgroundColor: hex }}
      >
        <span className="text-[10px] font-semibold" style={{ color: text }}>
          {hex}
        </span>
      </div>
      <div className="bg-white px-2 py-1.5">
        <p className="text-xs font-medium text-deep">--{name}</p>
        <p className="text-[10px] text-deep/50">var(--{name})</p>
      </div>
    </div>
  );
}

function ColorsSection() {
  return (
    <div className="flex flex-col gap-6">
      <Section title="Brand palette">
        <div className="flex flex-wrap gap-3">
          {brandColors.map((c) => (
            <ColorSwatch key={c.name} {...c} />
          ))}
        </div>
      </Section>
      <Section title="Semantic tokens">
        <div className="flex flex-wrap gap-3">
          {semanticColors.map((c) => (
            <ColorSwatch key={c.name} {...c} />
          ))}
        </div>
      </Section>
    </div>
  );
}

function TypographySection() {
  return (
    <div className="flex flex-col gap-6">
      <Section title="Heading (display serif — Sincere Bhakti)">
        <div className="flex flex-col gap-3 rounded-xl border border-sand bg-white p-5">
          <Heading as="h1">Heading 1 — text-2xl font-bold</Heading>
          <Heading as="h2">Heading 2 — text-xl font-semibold</Heading>
          <Heading as="h3">Heading 3 — text-lg font-medium</Heading>
        </div>
      </Section>
      <Section title="Body (Geist Sans)">
        <div className="flex flex-col gap-2 rounded-xl border border-sand bg-white p-5">
          <p className="text-base">Base body text — 16px, regular weight.</p>
          <p className="text-sm">Small body text — 14px, used for supporting copy.</p>
          <p className="text-xs text-deep/50">Caption / metadata — 12px, muted.</p>
          <p className="text-sm font-medium">Label — 14px semibold, used on form fields.</p>
        </div>
      </Section>
    </div>
  );
}

function ButtonsSection() {
  return (
    <Section title="Button">
      <VariantGroup label="Variants">
        <Button variant="default">Default</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="outline-deep">Outline deep</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Destructive</Button>
        <Button variant="link">Link</Button>
      </VariantGroup>
      <VariantGroup label="Sizes">
        <Button size="xs">Extra small</Button>
        <Button size="sm">Small</Button>
        <Button size="default">Default</Button>
        <Button size="lg">Large</Button>
        <Button size="xl">Extra large</Button>
      </VariantGroup>
      <VariantGroup label="With icon">
        <Button icon={<Mail />}>Start icon</Button>
        <Button icon={<Mail />} iconPosition="end">
          End icon
        </Button>
        <Button variant="icon" icon={<Pencil />} aria-label="Edit" />
        <Button variant="icon-destructive" icon={<Trash2 />} aria-label="Delete" />
        <Button variant="icon" size="icon-sm" icon={<Star />} aria-label="Star" />
      </VariantGroup>
      <VariantGroup label="States">
        <Button disabled>Disabled</Button>
        <Button variant="outline" disabled>
          Disabled outline
        </Button>
      </VariantGroup>
    </Section>
  );
}

function CardsSection() {
  return (
    <Section title="Card">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card variant="default">
          <p className="font-medium">Default</p>
          <p className="text-sm text-deep/60">Default padding (md).</p>
        </Card>
        <Card variant="elevated">
          <p className="font-medium">Elevated</p>
          <p className="text-sm text-deep/60">Larger shadow, xl padding.</p>
        </Card>
        <Card variant="flat">
          <p className="font-medium">Flat</p>
          <p className="text-sm text-deep/60">No shadow, lg padding.</p>
        </Card>
        <Card variant="hover" padding="lg">
          <p className="font-medium">Hover</p>
          <p className="text-sm text-deep/60">Tints on hover.</p>
        </Card>
      </div>
    </Section>
  );
}

function FeedbackSection() {
  return (
    <Section title="Feedback">
      <VariantGroup label="InfoBox">
        <div className="w-full max-w-xl">
          <InfoBox variant="info">Informational message explaining something.</InfoBox>
        </div>
        <div className="w-full max-w-xl">
          <InfoBox variant="warning">A warning the user should pay attention to.</InfoBox>
        </div>
        <div className="w-full max-w-xl">
          <InfoBox variant="error">Something went wrong and needs attention.</InfoBox>
        </div>
        <div className="w-full max-w-xl">
          <InfoBox variant="success">The action completed successfully.</InfoBox>
        </div>
        <div className="w-full max-w-xl">
          <InfoBox
            variant="info"
            title="With title and action"
            action={
              <Button href="/design-system" variant="outline" size="sm">
                Go somewhere
              </Button>
            }
          >
            A closable, titled infobox with a call to action.
          </InfoBox>
        </div>
      </VariantGroup>
      <VariantGroup label="Alert">
        <div className="w-full max-w-xl">
          <Alert variant="info">Info alert with lucide icon.</Alert>
        </div>
        <div className="w-full max-w-xl">
          <Alert variant="success">Success alert.</Alert>
        </div>
        <div className="w-full max-w-xl">
          <Alert variant="destructive">Destructive alert.</Alert>
        </div>
      </VariantGroup>
    </Section>
  );
}

function FormsSection() {
  const [withError, setWithError] = useState(false);
  const [checked, setChecked] = useState(false);

  return (
    <Section title="Forms">
      <VariantGroup label="Input">
        <div className="w-full max-w-md">
          <Input placeholder="Placeholder" aria-label="Input" />
        </div>
        <div className="w-full max-w-md">
          <Input defaultValue="Filled value" aria-label="Filled input" />
        </div>
        <div className="w-full max-w-md">
          <Input
            maxLength={30}
            minLengthHint={8}
            defaultValue="sh"
            aria-label="Input with counter"
          />
        </div>
        <div className="w-full max-w-md">
          <Input errorMessage="This field is required" aria-label="Invalid input" />
        </div>
        <div className="w-full max-w-md">
          <Input disabled placeholder="Disabled" aria-label="Disabled input" />
        </div>
      </VariantGroup>
      <VariantGroup label="Textarea">
        <div className="w-full max-w-md">
          <Textarea rows={4} placeholder="Write something…" aria-label="Textarea" />
        </div>
      </VariantGroup>
      <VariantGroup label="Post composer — desktop (md+)">
        <div className="w-full max-w-2xl rounded-2xl border border-sand bg-white p-4 shadow-sm">
          <Textarea
            size="compose"
            autoResize
            placeholder="Write a post… auto-grows as you type."
            aria-label="Post composer desktop"
            defaultValue="The compose variant starts tall (min-h-40 on desktop) and grows with the content."
          />
        </div>
      </VariantGroup>
      <VariantGroup label="Post composer — mobile">
        <div className="w-full max-w-[22rem] rounded-2xl border border-sand bg-white p-3 shadow-sm">
          <Textarea
            size="compose"
            autoResize
            placeholder="Write a post…"
            aria-label="Post composer mobile"
            defaultValue="On mobile it is more compact (min-h-28) and uses 16px text so iOS never auto-zooms."
          />
        </div>
      </VariantGroup>
      <VariantGroup label="Switch">
        <button
          type="button"
          onClick={() => setChecked((c) => !c)}
          className="flex items-center gap-3"
        >
          <Switch checked={checked} onCheckedChange={setChecked} />
          <span className="text-sm">Toggle: {checked ? "on" : "off"}</span>
        </button>
        <Switch checked={false} disabled aria-label="Disabled switch" />
      </VariantGroup>
      <VariantGroup label="Skeleton">
        <div className="flex w-full max-w-sm flex-col gap-2 rounded-xl border border-sand bg-white p-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-4 w-full" />
        </div>
      </VariantGroup>
      <button type="button" onClick={() => setWithError((e) => !e)} className="text-xs underline">
        {withError ? "Clear" : "Show"} controlled error
      </button>
    </Section>
  );
}

function NavigationSection() {
  return (
    <Section title="Navigation & overlays">
      <VariantGroup label="Breadcrumb">
        <Breadcrumb
          items={[
            { label: "Home", href: "/" },
            { label: "Channels", href: "/channels" },
            { label: "Current page" },
          ]}
        />
      </VariantGroup>
      <VariantGroup label="Tooltip">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button variant="icon" icon={<Pencil />} aria-label="Edit" />
              }
            >
              <span className="sr-only">Edit</span>
            </TooltipTrigger>
            <TooltipContent>Edit this item</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </VariantGroup>
      <VariantGroup label="Dialog">
        <Dialog>
          <DialogTrigger
            render={<Button variant="outline">Open dialog</Button>}
          />
          <DialogContent>
            <DialogHeader
              text="Dialog title"
              subheading="Supporting description for the dialog content."
            />
            <p className="text-sm text-deep/70">
              Dialog body content goes here. Use DialogHeader for the standard
              title + description layout.
            </p>
            <DialogFooter>
              <Button variant="outline">Cancel</Button>
              <Button>Confirm</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </VariantGroup>
    </Section>
  );
}

const TABS = [
  { value: "colors", label: "Colors", content: <ColorsSection /> },
  { value: "typography", label: "Typography", content: <TypographySection /> },
  { value: "components", label: "Components", content: (
    <div className="flex flex-col gap-10">
      <ButtonsSection />
      <CardsSection />
      <FeedbackSection />
      <FormsSection />
      <NavigationSection />
    </div>
  )},
] as const;

export default function DesignSystemHarness() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-bold text-deep">Design System</h1>
        <p className="text-sm text-deep/60">
          Living gallery of the shared UI kit — dev-only, not indexed.
        </p>
      </header>
      <TabsRoot defaultValue="colors">
        <TabsList>
          {TABS.map((t) => (
            <TabsTab key={t.value} value={t.value}>
              {t.label}
            </TabsTab>
          ))}
        </TabsList>
        {TABS.map((t) => (
          <TabsPanel key={t.value} value={t.value}>
            {t.content}
          </TabsPanel>
        ))}
      </TabsRoot>
    </div>
  );
}
