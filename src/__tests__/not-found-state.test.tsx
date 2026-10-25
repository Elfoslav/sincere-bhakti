import { expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/i18n/navigation", () => ({ Link: (props: ComponentProps<"a">) => <a {...props} /> }));

import NotFoundState from "@/components/NotFoundState";

it("offers a translated route back to content from the shared 404 state", () => {
  render(<NotFoundState jokeIndex={0} />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("404");
  expect(document.title).toBe("404 · somethingWentWrong");
  expect(screen.getByText("joke0Headline")).toBeVisible();
  expect(screen.getByRole("link", { name: "backToPosts" })).toHaveAttribute("href", "/posts");
});
