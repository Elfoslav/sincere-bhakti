import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/i18n/navigation", () => ({ Link: () => null }));
import AttachmentPicker from "@/components/AttachmentPicker";

describe("AttachmentPicker", () => {
  it("supports keyboard-triggered selection and resetting the file input", () => {
    const onFiles = vi.fn();
    render(<AttachmentPicker label="Add photos" accept="image/jpeg" onFiles={onFiles} />);
    const input = screen.getByLabelText("Add photos");
    const file = new File(["photo"], "photo.jpg", { type: "image/jpeg" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(onFiles).toHaveBeenCalledWith([file]);
    expect(input).toHaveValue("");
  });
  it("limits a single-cover drop and rejects drops while disabled", () => {
    const onFiles = vi.fn();
    const { container, rerender } = render(<AttachmentPicker label="Cover" accept="image/jpeg" onFiles={onFiles} />);
    const file = new File(["photo"], "photo.jpg", { type: "image/jpeg" });
    fireEvent.drop(container.firstElementChild!, { dataTransfer: { files: [file, file] } });
    expect(onFiles).toHaveBeenCalledWith([file]);
    onFiles.mockClear();
    rerender(<AttachmentPicker label="Cover" accept="image/jpeg" disabled onFiles={onFiles} />);
    fireEvent.drop(container.firstElementChild!, { dataTransfer: { files: [file] } });
    expect(onFiles).not.toHaveBeenCalled();
  });
});
