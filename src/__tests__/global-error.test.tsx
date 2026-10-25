import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/i18n/navigation", () => ({ Link: () => null }));
vi.spyOn(console, "error").mockImplementation(() => {});

import GlobalError from "@/app/global-error";

it("renders shared translated recovery without the root layout's providers", () => {
  const markup = renderToStaticMarkup(<GlobalError error={new Error("root failed")} reset={vi.fn()} />);
  expect(markup).toContain('<html lang="en">');
  expect(markup).toContain("Something went wrong");
  expect(markup).toContain("Try again");
  expect(markup).not.toContain("root failed");
});
