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
