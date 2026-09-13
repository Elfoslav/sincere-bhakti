/**
 * A unified category reference (timeline posts and blog articles share one
 * taxonomy, scoped per language like the posts themselves). `name` is the
 * canonical Title Case form; `slug` is its URL key for /blog/category/[slug].
 */
export interface CategoryRef {
  id: string;
  name: string;
  slug: string;
  language: string;
}
