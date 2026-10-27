import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/i18n/navigation", () => ({ Link: (props: ComponentProps<"a">) => <a {...props} /> }));

import PostsJournalLayout from "@/components/PostsJournalLayout";

const channel = { id: "c1", name: "Real channel", slug: "real-channel", avatarUrl: null, ownerId: "u1" };

describe("PostsJournalLayout", () => {
  it("renders the journal hierarchy, real channel links, and guest actions", () => {
    render(<PostsJournalLayout channels={[channel]} authenticated={false} filters={<input aria-label="Search" />}><p>Live posts</p></PostsJournalLayout>);
    expect(screen.getByRole("heading", { level: 1, name: "title" })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "journalLabel" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Real channel/ })).toHaveAttribute("href", "/channels/real-channel");
    expect(screen.getByRole("link", { name: "browseChannels" })).toHaveAttribute("href", "/channels");
    expect(screen.getByText("Live posts")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "signIn" })).toHaveLength(1);
  });

  it("does not show guest prompts to signed-in users or invent channels for an empty feed", () => {
    render(<PostsJournalLayout channels={[]} authenticated filters={null}>Empty feed</PostsJournalLayout>);
    expect(screen.queryByRole("link", { name: "signIn" })).not.toBeInTheDocument();
    expect(screen.queryByText(channel.name)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "browseChannels" })).toBeInTheDocument();
  });
});
