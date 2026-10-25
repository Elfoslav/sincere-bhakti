import { expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/i18n/navigation", () => ({ Link: () => null }));
vi.spyOn(console, "error").mockImplementation(() => {});

import ErrorState from "@/components/ErrorState";

it("keeps error recovery accessible and invokes the supplied retry action", () => {
  const reset = vi.fn();
  render(<ErrorState error={new Error("test failure")} reset={reset} />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("somethingWentWrong");
  fireEvent.click(screen.getByRole("button", { name: "tryAgain" }));
  expect(reset).toHaveBeenCalledOnce();
});
