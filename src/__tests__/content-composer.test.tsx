import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/i18n/navigation", () => ({ Link: () => null }));

import ContentComposer from "@/components/ContentComposer";

function Harness() {
  const [open, setOpen] = useState(false);
  return <><button onClick={() => setOpen(true)}>Create</button><ContentComposer open={open} onOpenChange={setOpen} title="New content">
    {({ formState, requestClose, complete }) => <div><textarea aria-label="Draft" onChange={event => formState.onDirtyChange(Boolean(event.target.value))} />
      <button onClick={requestClose}>Cancel</button><button onClick={() => formState.onSubmittingChange(true)}>Start saving</button>
      <button onClick={complete}>Saved</button></div>}
  </ContentComposer></>;
}

describe("ContentComposer", () => {
  it("confirms dismissal and preserves the draft through Keep editing and expansion", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    const draft = await screen.findByRole("textbox", { name: "Draft" });
    fireEvent.change(draft, { target: { value: "My reflection" } });
    fireEvent.click(screen.getByRole("button", { name: "expand" }));
    expect(draft).toHaveValue("My reflection");
    expect(draft.closest('[data-slot="dialog-content"]')).toHaveClass("content-composer-expanded");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(await screen.findByText("unsavedTitle")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "keepEditing" }));
    await waitFor(() => expect(screen.queryByText("unsavedTitle")).not.toBeInTheDocument());
    expect(draft).toHaveValue("My reflection");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(await screen.findByRole("button", { name: "discard" }));
    await waitFor(() => expect(screen.queryByRole("textbox")).not.toBeInTheDocument());
  });

  it("blocks dismissal during a save and closes on successful completion", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(await screen.findByRole("status")).toBeEmptyDOMElement();
    expect(screen.getByRole("status")).toHaveClass("sr-only");
    fireEvent.click(await screen.findByRole("button", { name: "Start saving" }));
    expect(screen.getByRole("button", { name: "close" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("working");
    fireEvent.click(screen.getByRole("button", { name: "Saved" }));
    await waitFor(() => expect(screen.queryByRole("textbox")).not.toBeInTheDocument());
  });
});
