export type UrlToken =
  | { type: "text"; value: string }
  | { type: "url"; url: string };

// Match http(s) URLs, stopping at whitespace and angle brackets. The strict
// scheme means `javascript:`/`data:` can never match by construction.
const URL_REGEX = /https?:\/\/[^\s<>]+/gi;

const TRAILING_PUNCTUATION = /[.,;:!?'"]+$/;

// Closing brackets are stripped from a URL only when unbalanced — a balanced
// `)` (e.g. Wikipedia-style `.../Foo_(bar)`) belongs to the URL itself.
const CLOSING_BRACKETS: [close: string, open: string][] = [
  [")", "("],
  ["]", "["],
  ["}", "{"],
];

function countChar(text: string, char: string): number {
  let count = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === char) count++;
  }
  return count;
}

function cleanUrl(url: string): string {
  let result = url;
  for (const [close, open] of CLOSING_BRACKETS) {
    while (
      result.endsWith(close) &&
      countChar(result, close) > countChar(result, open)
    ) {
      result = result.slice(0, -1);
    }
  }
  return result.replace(TRAILING_PUNCTUATION, "");
}

/**
 * Split text into alternating plain-text and URL tokens. URLs are matched
 * with the same `https?://` rule and are safe to render (never a dangerous
 * scheme). Used for autolinking post content without `dangerouslySetInnerHTML`.
 */
export function tokenizeUrls(text: string | null | undefined): UrlToken[] {
  if (!text) return [];

  const tokens: UrlToken[] = [];
  const push = (token: UrlToken) => {
    const last = tokens[tokens.length - 1];
    if (last && last.type === "text" && token.type === "text") {
      last.value += token.value;
    } else {
      tokens.push(token);
    }
  };
  let lastIndex = 0;
  const regex = new RegExp(URL_REGEX.source, "gi");
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const full = match[0];
    if (match.index > lastIndex) {
      push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    const url = cleanUrl(full);
    if (url) {
      push({ type: "url", url });
    }
    // The cleaned URL may be shorter than the full match (trailing punctuation
    // was stripped); emit the stripped suffix back as text.
    const suffix = full.slice(url.length);
    if (suffix) {
      push({ type: "text", value: suffix });
    }
    lastIndex = match.index + full.length;
  }

  if (lastIndex < text.length) {
    push({ type: "text", value: text.slice(lastIndex) });
  }

  return tokens;
}

/** Return the first http(s) URL in text, or null. Used to pick the link to preview. */
export function getFirstUrl(text: string | null | undefined): string | null {
  if (!text) return null;
  const first = tokenizeUrls(text).find((token) => token.type === "url");
  return first && first.type === "url" ? first.url : null;
}
