import type { BlogPost } from "@/types/blog";

function makeMockPost(id: string, title: string, excerpt: string): BlogPost {
  return {
    id,
    shortId: `mock${id}`,
    slug: title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    title,
    excerpt,
    content: excerpt,
    contentHtml: null,
    coverUrl: null,
    isPublic: true,
    language: "en",
    publishedAt: "2026-09-01T00:00:00.000Z",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    channel: {
      id: "channel-mock",
      name: "Bhakti Sangha",
      slug: "bhakti-sangha",
      avatarUrl: null,
      ownerId: "user-mock",
    },
  };
}

export const mockMainPost: BlogPost = makeMockPost(
  "main",
  "The Sweetness of the Holy Name",
  "How sincere chanting softens the heart and awakens our dormant love for Krishna, one sincere round at a time.",
);

export const mockLatestPosts: BlogPost[] = [
  makeMockPost(
    "a",
    "Six Goswamis of Vrindavan",
    "The lives and teachings of the six Goswamis who mapped the path of raganuga bhakti for the modern age.",
  ),
  makeMockPost(
    "b",
    "Why We Offer Tulasi",
    "Tulasi-devi carries our prayers directly to the Lord — the story behind the sacred plant on every altar.",
  ),
  makeMockPost(
    "c",
    "Ekadasis of the Year",
    "A complete guide to observing Ekadasi: dates, grains to avoid, and the mood of increased remembrance.",
  ),
];

export const mockContentHtml =
  "<p>Chanting the holy names is the simplest doorway into bhakti. When we sit down with our beads each morning, we are not performing a ritual — we are calling out, the way a child calls for their mother.</p>" +
  "<h2>Attention Is the Offering</h2>" +
  "<p>The mantra works even when our minds wander, but the sweetness multiplies when we listen. Try hearing every syllable of one full round today; that single attentive round can change the taste of the other fifteen.</p>" +
  "<blockquote>Patience on the path is itself a form of surrender.</blockquote>" +
  "<p>Begin where you are. One round, offered sincerely, outweighs a hundred rushed ones.</p>";
