import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("next-intl", () => ({
  useTranslations: vi.fn(() => (key: string, vars?: Record<string, string | number>) => {    const messages: Record<string, string> = {
      searchPlaceholder: "Search or create categories...",
      maxReached: `Up to ${vars?.max} categories`,
      removeCategory: `Remove ${vars?.name}`,
    };
    if (key === "createNew") return `Create "${vars?.name}"`;
    return messages[key] ?? key;
  }),
  useLocale: vi.fn(() => "en"),
}));

vi.spyOn(console, "error").mockImplementation(() => {});

import CategoryPicker from "@/components/CategoryPicker";

function searchResponse(names: string[]) {
  return {
    ok: true,
    json: () => Promise.resolve({ categories: names.map((name, i) => ({ id: `c${i}`, name })) }),
  } as Response;
}

describe("CategoryPicker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue(searchResponse([]));
  });

  it("keeps typed input as-is and canonicalizes on create", () => {
    render(<CategoryPicker value={[]} onChange={() => {}} />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "holy name" } });
    expect(input).toHaveValue("holy name");
  });

  it("lists search matches and selects one", async () => {
    const onChange = vi.fn();
    vi.mocked(global.fetch).mockResolvedValue(searchResponse(["Holy Name", "Holy Basil"]));
    render(<CategoryPicker value={[]} onChange={onChange} />);

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "holy" } });

    const option = await screen.findByRole("option", { name: "Holy Name" });
    fireEvent.mouseDown(option);
    expect(onChange).toHaveBeenCalledWith(["Holy Name"]);
    expect(vi.mocked(global.fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/api/categories?"),
      expect.anything(),
    );
  });

  it("offers a create row when nothing matches exactly", async () => {
    const onChange = vi.fn();
    render(<CategoryPicker value={[]} onChange={onChange} />);

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "brand new" } });

    const createRow = await screen.findByRole("option", { name: 'Create "Brand New"' });
    fireEvent.mouseDown(createRow);
    expect(onChange).toHaveBeenCalledWith(["Brand New"]);
  });

  it("hides already-selected matches and the create row for exact hits", async () => {
    vi.mocked(global.fetch).mockResolvedValue(searchResponse(["Bhakti"]));
    render(<CategoryPicker value={["Bhakti"]} onChange={() => {}} />);

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "bhakti" } });

    await waitFor(() => expect(vi.mocked(global.fetch)).toHaveBeenCalled());
    await waitFor(() => {
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });
  });

  it("removes a selected chip", () => {
    const onChange = vi.fn();
    render(<CategoryPicker value={["Bhakti", "Kirtan"]} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Remove Bhakti" }));
    expect(onChange).toHaveBeenCalledWith(["Kirtan"]);
  });

  it("blocks new picks at the max and shows the hint", async () => {
    const onChange = vi.fn();
    render(<CategoryPicker value={["A", "B"]} onChange={onChange} max={2} />);

    expect(screen.getByText("Up to 2 categories")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "c" } });

    await waitFor(() => expect(vi.mocked(global.fetch)).toHaveBeenCalled());
    await waitFor(() => {
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("selects with the keyboard", async () => {
    const onChange = vi.fn();
    vi.mocked(global.fetch).mockResolvedValue(searchResponse(["Kirtan"]));
    render(<CategoryPicker value={[]} onChange={onChange} />);
    const input = screen.getByRole("combobox");

    fireEvent.change(input, { target: { value: "kirt" } });
    await screen.findByRole("option", { name: "Kirtan" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith(["Kirtan"]);
  });
});
