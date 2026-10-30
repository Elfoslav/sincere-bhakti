import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key === "close" ? "Zavrieť" : key }));
vi.mock("@/i18n/navigation", () => ({ Link: () => null }));

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

describe("Dialog", () => {
  it("translates the close control and restores focus after dismissal", async () => {
    render(<Dialog><DialogTrigger render={<Button>Open</Button>} /><DialogContent><DialogHeader text="Settings" subheading="Change preferences" /><input aria-label="Name" /></DialogContent></Dialog>);
    const trigger = screen.getByRole("button", { name: "Open" });
    fireEvent.click(trigger);
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Name" })).toHaveFocus());
    fireEvent.click(await screen.findByRole("button", { name: "Zavrieť" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("translates the optional footer close action", async () => {
    render(<Dialog defaultOpen><DialogContent showCloseButton={false}><DialogHeader text="Settings" subheading="Change preferences" /><DialogFooter showCloseButton /></DialogContent></Dialog>);
    expect(await screen.findByRole("button", { name: "Zavrieť" })).toBeInTheDocument();
  });
});
