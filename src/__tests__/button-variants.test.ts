import { describe, it, expect, vi } from "vitest";

// button.tsx imports Link from next-intl navigation, which doesn't resolve in
// the vitest environment — only the pure cva config is under test here.
vi.mock("@/i18n/navigation", () => ({ Link: () => null }));

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// The Button component renders cn(buttonVariants(...)) — cn runs tailwind-merge,
// which keeps the LAST conflicting class. These tests guard the declaration
// order in the cva config: size radii must not override pill variants.
function mergedClasses(opts: Parameters<typeof buttonVariants>[0]): string {
  return cn(buttonVariants(opts));
}

describe("buttonVariants rounded styles", () => {
  const pillVariants = ["default", "outline-deep", "outline", "destructive"] as const;
  const sizesWithOwnRadius = ["xs", "sm", "icon-xs", "icon-sm"] as const;
  const sizesWithoutRadius = ["default", "lg", "xl", "xxl", "hero", "icon", "icon-lg"] as const;

  it.each(pillVariants)("variant %s stays a pill at every size", (variant) => {
    for (const size of [...sizesWithOwnRadius, ...sizesWithoutRadius]) {
      const classes = mergedClasses({ variant, size });
      expect(classes, `${variant}/${size}`).toContain("rounded-full");
      expect(classes, `${variant}/${size}`).not.toMatch(/rounded-\[min/);
    }
  });

  it.each(["ghost", "secondary", "gold"] as const)(
    "non-pill variant %s keeps size-tuned radius at small sizes",
    (variant) => {
      const classes = mergedClasses({ variant, size: "sm" });
      expect(classes).toMatch(/rounded-\[min/);
      expect(classes).not.toContain("rounded-full");
    },
  );

  it.each(["icon", "icon-destructive", "icon-light"] as const)(
    "icon variant %s keeps size-tuned radius at small sizes",
    (variant) => {
      const classes = mergedClasses({ variant, size: "icon-sm" });
      expect(classes).toMatch(/rounded-\[min/);
      expect(classes).not.toContain("rounded-full");
    },
  );

  it("default icon-only size uses the shared 18px glyph size", () => {
    const classes = mergedClasses({ variant: "icon", size: "icon" });
    expect(classes).toContain("size-8");
    expect(classes).toContain("[&_svg:not([class*='size-'])]:size-[18px]");
  });

  it("buttons use pointer cursor by default", () => {
    expect(mergedClasses({ variant: "icon", size: "icon" })).toContain("cursor-pointer");
  });

  it("default variant avoids glossy gradient borders", () => {
    const classes = mergedClasses({ variant: "default", size: "default" });
    expect(classes).toContain("bg-saffron");
    expect(classes).toContain("bg-clip-padding");
    expect(classes).not.toContain("bg-gradient-to-b");
    expect(classes).not.toContain("bg-clip-border");
  });

  it("aria-disabled buttons do not show active movement or focus glow", () => {
    const classes = mergedClasses({ variant: "icon", size: "icon" });
    expect(classes).toContain("aria-disabled:active:translate-y-0");
    expect(classes).toContain("aria-disabled:focus-visible:border-transparent");
    expect(classes).toContain("aria-disabled:focus-visible:ring-0");
  });

  it("non-pill variants fall back to the base radius at default size", () => {
    const classes = mergedClasses({ variant: "ghost", size: "default" });
    expect(classes).toContain("rounded-lg");
    expect(classes).not.toContain("rounded-full");
  });

  it("caller className still wins over everything", () => {
    const classes = cn(buttonVariants({ variant: "default", size: "sm" }), "rounded-none");
    expect(classes).toContain("rounded-none");
    expect(classes).not.toContain("rounded-full");
  });
});
