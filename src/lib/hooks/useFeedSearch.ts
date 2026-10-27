import { useCallback, useSyncExternalStore } from "react";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { SEARCH_DEBOUNCE_MS } from "@/lib/validation";

const subscribe = (onChange: () => void) => {
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
};
const getSnapshot = () => new URLSearchParams(window.location.search).get("q") ?? "";
const getServerSnapshot = () => "";

/** URL-backed typing survives reload, sharing and back/forward; only API searches are debounced. */
export function useFeedSearch() {
  const searchInput = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const setSearchInput = useCallback((value: string) => {
    const url = new URL(window.location.href);
    if (value) url.searchParams.set("q", value);
    else url.searchParams.delete("q");
    window.history.replaceState(window.history.state, "", url);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, []);
  const search = useDebouncedValue(searchInput.trim(), SEARCH_DEBOUNCE_MS);
  const clearSearch = useCallback(() => setSearchInput(""), [setSearchInput]);
  return { searchInput, setSearchInput, search, clearSearch };
}
