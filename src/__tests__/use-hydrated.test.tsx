import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { useHydrated } from "@/lib/hooks/useHydrated";

function Control() {
  const ready = useHydrated();
  return <button disabled={!ready}>Open menu</button>;
}

it("disables handler-dependent controls on the server and enables them on the client", () => {
  expect(renderToString(<Control />)).toContain('disabled=""');
  render(<Control />);
  expect(screen.getByRole("button", { name: "Open menu" })).toBeEnabled();
});
