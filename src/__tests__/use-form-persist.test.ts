import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useFormPersist } from "@/lib/hooks/useFormPersist";

const STORAGE_KEY = "form:test-form";

describe("useFormPersist", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("returns empty stored and loaded=false initially, then loaded=true after mount", () => {
    const { result } = renderHook(() => useFormPersist("test-form"));

    expect(result.current.stored).toBeNull();
    expect(result.current.loaded).toBe(true);
  });

  it("saves data to localStorage", () => {
    const { result } = renderHook(() => useFormPersist("test-form"));

    act(() => {
      result.current.save({ name: "Krishna", email: "k@example.com" });
    });

    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).toBe(JSON.stringify({ name: "Krishna", email: "k@example.com" }));
  });

  it("saves and restores data across remounts", () => {
    const { result, unmount } = renderHook(() => useFormPersist("test-form"));

    act(() => {
      result.current.save({ name: "Krishna" });
    });

    unmount();

    const { result: result2 } = renderHook(() => useFormPersist("test-form"));

    expect(result2.current.stored).toEqual({ name: "Krishna" });
  });

  it("excludes password field from storage", () => {
    const { result } = renderHook(() => useFormPersist("test-form", ["password"]));

    act(() => {
      result.current.save({ name: "Krishna", password: "secret123", email: "k@example.com" });
    });

    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toContain("secret123");
    expect(raw).toContain("Krishna");
    expect(raw).toContain("k@example.com");
  });

  it("clears stored data", () => {
    const { result } = renderHook(() => useFormPersist("test-form"));

    act(() => {
      result.current.save({ name: "Krishna" });
    });
    expect(localStorage.getItem(STORAGE_KEY)).toBeTruthy();

    act(() => {
      result.current.clear();
    });

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(result.current.stored).toBeNull();
  });

  it("removes key from storage when all fields are empty", () => {
    const { result } = renderHook(() => useFormPersist("test-form"));

    act(() => {
      result.current.save({ name: "", email: undefined as any });
    });

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});