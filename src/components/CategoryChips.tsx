import type { CategoryRef } from "@/types/category";

interface CategoryChipsProps {
  categories: CategoryRef[];
  onSelect?: (category: CategoryRef) => void;
  className?: string;
}

/**
 * Read-only category chips for cards and detail pages. Becomes interactive
 * (filtering) once an `onSelect` handler is provided.
 */
export default function CategoryChips({ categories, onSelect, className = "" }: CategoryChipsProps) {
  // Defensive: API responses always carry the field, but never crash the
  // whole card on a stale payload missing it.
  if (!categories || categories.length === 0) return null;
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {categories.map((category) =>
        onSelect ? (
          <button
            key={category.id}
            type="button"
            onClick={() => onSelect(category)}
            className="rounded-full bg-deep/5 px-2.5 py-0.5 text-xs font-semibold tracking-wide text-deep/70 hover:bg-gold-light/25 hover:text-deep"
          >
            {category.name}
          </button>
        ) : (
          <span
            key={category.id}
            className="rounded-full bg-deep/5 px-2.5 py-0.5 text-xs font-semibold tracking-wide text-deep/70"
          >
            {category.name}
          </span>
        ),
      )}
    </div>
  );
}
