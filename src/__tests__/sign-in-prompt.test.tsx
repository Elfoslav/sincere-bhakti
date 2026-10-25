import { expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";

vi.mock("@/i18n/navigation", () => ({ Link: (props: ComponentProps<"a">) => <a {...props} /> }));

import SignInPrompt from "@/components/SignInPrompt";

it("keeps the sign-in action and supplied translated context together", () => {
  render(<SignInPrompt label="Prihlásiť sa">a zdieľať príspevok</SignInPrompt>);
  expect(screen.getByRole("link", { name: "Prihlásiť sa" })).toHaveAttribute("href", "/login");
  expect(screen.getByText(/a zdieľať príspevok/)).toHaveTextContent("Prihlásiť sa a zdieľať príspevok");
});
