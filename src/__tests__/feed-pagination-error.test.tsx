vi.mock("@/i18n/navigation", () => ({ Link: () => null }));
import { render, screen, fireEvent } from "@testing-library/react";
import { expect, it, vi } from "vitest";
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
import FeedPaginationError from "@/components/FeedPaginationError";
it("only offers pagination recovery after a failure", () => {
  const retry = vi.fn();
  const { rerender } = render(<FeedPaginationError error={false} retry={retry} />);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  rerender(<FeedPaginationError error retry={retry} />);
  fireEvent.click(screen.getByRole("button", { name: "retry" }));
  expect(retry).toHaveBeenCalledOnce();
});
