import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("next-intl", () => ({ useTranslations: () => (key: string, args?: { count: number }) => args ? `${key}:${args.count}` : key }));
import BlogAnalytics from "@/components/BlogAnalytics";
let visibility = "visible";
let bottom = 2000;
let clock = 0;
const fetchMock = vi.fn();
beforeEach(() => {
  vi.useFakeTimers();
  visibility = "visible"; bottom = 2000; clock = 0;
  vi.spyOn(performance, "now").mockImplementation(() => clock);
  vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility as DocumentVisibilityState);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => ({ bottom } as DOMRect));
  fetchMock.mockReset().mockResolvedValue({ ok: true, json: async () => ({ views: 4, reads: 1, uniqueVisitors: 3 }) });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function advance(ms: number) {
  await act(async () => { clock += ms; await vi.advanceTimersByTimeAsync(ms); });
}
it("sends a view and waits for foreground time AND the article end before a read", async () => {
  render(<BlogAnalytics postId="article" />);
  await advance(1000);
  expect(screen.getByText(/views:4/)).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0][1].credentials).toBe("omit");
  await advance(31000);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  bottom = 10;
  await advance(1000);
  expect(JSON.parse(fetchMock.mock.calls[1][1].body).event).toBe("read");
  expect(JSON.parse(fetchMock.mock.calls[0][1].body).visitId).toBe(JSON.parse(fetchMock.mock.calls[1][1].body).visitId);
  await advance(60000);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
it("does not count background time or start a background visit", async () => {
  visibility = "hidden"; bottom = 10;
  render(<BlogAnalytics postId="article" />);
  await advance(60000);
  expect(fetchMock).not.toHaveBeenCalled();
  await act(async () => { visibility = "visible"; document.dispatchEvent(new Event("visibilitychange")); });
  await advance(1000);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  await advance(28000);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  await advance(2000);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
it("displays counts without collection when Do Not Track is enabled", async () => {
  Object.defineProperty(navigator, "doNotTrack", { configurable: true, get: () => "1" });
  render(<BlogAnalytics postId="article" />);
  await advance(60000);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0][1].method).toBeUndefined();
  Reflect.deleteProperty(navigator, "doNotTrack");
});
