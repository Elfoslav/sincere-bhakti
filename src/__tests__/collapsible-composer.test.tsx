import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));

const formProps = vi.hoisted(() => ({ current: null as null | { onSuccess: (p: unknown) => void; onCancel?: () => void } }));
vi.mock("@/components/PostForm", () => ({
  default: (props: { onSuccess: (p: unknown) => void; onCancel?: () => void }) => {
    formProps.current = props;
    return (
      <form>
        <textarea aria-label="draft" />
        <button type="button" onClick={props.onCancel}>cancel</button>
      </form>
    );
  },
}));

import CollapsibleComposer from "@/components/CollapsibleComposer";

describe("CollapsibleComposer", () => {
  it("starts collapsed behind the compose prompt without stealing focus", () => {
    render(<CollapsibleComposer onSuccess={() => {}} />);
    const trigger = screen.getByRole("button", { name: "composePlaceholder" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByLabelText("draft", { selector: "textarea" })).not.toBeVisible();
    expect(trigger).not.toHaveFocus();
  });

  it("expands on click and focuses the textarea", () => {
    render(<CollapsibleComposer onSuccess={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "composePlaceholder" }));
    expect(screen.getByLabelText("draft")).toBeVisible();
    expect(screen.getByLabelText("draft")).toHaveFocus();
  });

  it("collapses on cancel, keeps the draft, and returns focus to the prompt", () => {
    render(<CollapsibleComposer onSuccess={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "composePlaceholder" }));
    fireEvent.change(screen.getByLabelText("draft"), { target: { value: "wip" } });
    fireEvent.click(screen.getByRole("button", { name: "cancel" }));
    const trigger = screen.getByRole("button", { name: "composePlaceholder" });
    expect(trigger).toHaveFocus();
    fireEvent.click(trigger);
    expect(screen.getByLabelText("draft")).toHaveValue("wip");
  });

  it("collapses after a successful post and forwards the post", () => {
    const onSuccess = vi.fn();
    render(<CollapsibleComposer onSuccess={onSuccess} />);
    fireEvent.click(screen.getByRole("button", { name: "composePlaceholder" }));
    const post = { id: "p1" };
    act(() => formProps.current!.onSuccess(post));
    expect(onSuccess).toHaveBeenCalledWith(post);
    expect(screen.getByRole("button", { name: "composePlaceholder" })).toHaveAttribute("aria-expanded", "false");
  });
});
