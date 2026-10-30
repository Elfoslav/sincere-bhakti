import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const result = vi.hoisted(() => ({ channelId: "page-channel" }));
vi.mock("@/components/ContentCreateAction", () => ({ default: ({ onClick }: { onClick: () => void }) => <button onClick={onClick}>Create</button> }));
vi.mock("@/components/ContentCreationDialog", () => ({ default: ({ open, onSuccess }: { open: boolean; onSuccess: (post: { channel: { id: string } }) => void }) => open ? <button onClick={() => onSuccess({ channel: { id: result.channelId } })}>Publish</button> : null }));

import ChannelPostCreate from "@/components/ChannelPostCreate";

beforeEach(() => { result.channelId = "page-channel"; });

describe("ChannelPostCreate", () => {
  it("adds a new post to the channel feed when the selected identity matches", () => {
    const onSuccess = vi.fn();
    render(<ChannelPostCreate postingChannel={{ id: "page-channel", name: "Community" }} onSuccess={onSuccess} />);
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it("does not add a post from a different identity to the channel feed", () => {
    result.channelId = "personal-channel";
    const onSuccess = vi.fn();
    render(<ChannelPostCreate postingChannel={{ id: "page-channel", name: "Community" }} onSuccess={onSuccess} />);
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
