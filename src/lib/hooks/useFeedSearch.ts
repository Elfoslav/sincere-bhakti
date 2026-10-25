import { useState } from "react";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { SEARCH_DEBOUNCE_MS } from "@/lib/validation";

/**
 * Search box state for a feed page: `searchInput` is the live text for the
 * input, `search` the trimmed, debounced value to put in the feed query.
 */
export function useFeedSearch() {
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput.trim(), SEARCH_DEBOUNCE_MS);
  return { searchInput, setSearchInput, search };
}
