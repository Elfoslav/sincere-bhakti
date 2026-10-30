import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key === "clearSearch" ? "Vymazať vyhľadávanie" : key }));
vi.mock("@/i18n/navigation", () => ({ Link: () => null }));

import SearchInput from "@/components/SearchInput";

describe("SearchInput", () => {
  it("keeps clearing available while a search is loading", () => {
    const onChange = vi.fn();
    render(<SearchInput value="bhakti" loading onChange={onChange} placeholder="Search" />);
    expect(screen.getByRole("searchbox")).toHaveAttribute("aria-busy", "true");
    fireEvent.click(screen.getByRole("button", { name: "Vymazať vyhľadávanie" }));
    expect(onChange).toHaveBeenCalledWith("");
  });
  it("names the search field and emits the entered query", () => {
    const onChange = vi.fn();
    render(<SearchInput value="" onChange={onChange} placeholder="Hľadať kanály" />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Hľadať kanály" }), { target: { value: "bhakti" } });
    expect(onChange).toHaveBeenCalledWith("bhakti");
  });

  it("clears the query through a translated accessible control", () => {
    const onChange = vi.fn();
    render(<SearchInput value="bhakti" onChange={onChange} placeholder="Hľadať kanály" />);
    fireEvent.click(screen.getByRole("button", { name: "Vymazať vyhľadávanie" }));
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("does not offer a clear action for an empty query", () => {
    render(<SearchInput value="" onChange={vi.fn()} placeholder="Hľadať kanály" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
  it("returns focus to search when clearing removes the clear control", () => {
    function Harness() {
      const [value, setValue] = useState("bhakti");
      return <SearchInput value={value} onChange={setValue} placeholder="Search" />;
    }
    render(<Harness />);
    const clear = screen.getByRole("button");
    clear.focus();
    fireEvent.click(clear);
    expect(screen.getByRole("searchbox")).toHaveValue("");
    expect(screen.getByRole("searchbox")).toHaveFocus();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("clears with Escape before letting a containing overlay dismiss", () => {
    const onKeyDown = vi.fn();
    const onChange = vi.fn();
    const { rerender } = render(<div onKeyDown={onKeyDown}><SearchInput value="bhakti" onChange={onChange} placeholder="Search" /></div>);
    fireEvent.keyDown(screen.getByRole("searchbox"), { key: "Escape" });
    expect(onChange).toHaveBeenCalledWith("");
    expect(onKeyDown).not.toHaveBeenCalled();
    rerender(<div onKeyDown={onKeyDown}><SearchInput value="" onChange={onChange} placeholder="Search" /></div>);
    fireEvent.keyDown(screen.getByRole("searchbox"), { key: "Escape" });
    expect(onKeyDown).toHaveBeenCalledOnce();
  });

});
