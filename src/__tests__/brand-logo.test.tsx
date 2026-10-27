import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
vi.mock("next-intl", () => ({ useTranslations: () => () => "Sincere Bhakti" }));
import BrandLogo from "@/components/BrandLogo";

describe("BrandLogo", () => {
  it("preserves the complete original logo in navigation", () => {
    render(<BrandLogo />);
    const logo = screen.getByRole("img", { name: "Sincere Bhakti" });
    expect(logo).toHaveAttribute("title", "Sincere Bhakti");
    expect(logo).toHaveStyle({ width: "104px", height: "auto" });
    expect(logo.getAttribute("src")).toContain("sincere-bhakti-logo.png");
  });
  it("retains the original complete artwork for display placements", () => {
    render(<BrandLogo size="display" />);
    expect(screen.getByRole("img", { name: "Sincere Bhakti" })).toHaveAttribute("title", "Sincere Bhakti");
  });
});
