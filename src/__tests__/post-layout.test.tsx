import { expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/i18n/navigation", () => ({ Link: (props: ComponentProps<"a">) => <a {...props} /> }));

import PostLayout from "@/components/PostLayout";

it("gives individual posts a page heading and a route back to their feed", () => {
  render(<PostLayout title="Post"><p>Community reflection</p></PostLayout>);
  expect(screen.getByRole("heading", { level: 1, name: "Post" })).toBeInTheDocument();
  expect(screen.getByRole("navigation", { name: "breadcrumb" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "title" })).toHaveAttribute("href", "/posts");
  expect(screen.getByText("Community reflection")).toBeVisible();
});
