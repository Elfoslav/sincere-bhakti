export type FeedbackVariant = "info" | "warning" | "error" | "success" | "destructive";

/**
 * Feedback colors derived from the Dawn Sādhana brand tokens (gold, saffron,
 * tulsi, destructive). Backgrounds/borders use `color-mix` to blend the hue
 * toward white — plain opacity overlays (e.g. `bg-gold/10`) desaturate toward
 * gray and read muddy, so mixing keeps the tint bright and clean. Text uses a
 * hue-tinted dark shade instead of near-black to stay colorful while readable.
 * Gold (info) and saffron (warning) are adjacent hues, so info is kept soft
 * while warning is pushed vivid orange to stay clearly distinct.
 */
export const feedbackContainerClasses: Record<FeedbackVariant, string> = {
  info:
    "border-[color-mix(in_oklab,var(--color-gold)_50%,white)] bg-[color-mix(in_oklab,var(--color-gold)_18%,white)] text-[color-mix(in_oklab,var(--color-gold)_45%,var(--color-deep))] dark:border-[color-mix(in_oklab,var(--color-gold)_50%,transparent)] dark:bg-[color-mix(in_oklab,var(--color-gold)_18%,var(--color-deep))] dark:text-gold-light",
  warning:
    "border-[color-mix(in_oklab,var(--color-saffron)_70%,white)] bg-[color-mix(in_oklab,var(--color-saffron)_30%,white)] text-[color-mix(in_oklab,var(--color-saffron)_50%,var(--color-deep))] dark:border-[color-mix(in_oklab,var(--color-saffron)_65%,transparent)] dark:bg-[color-mix(in_oklab,var(--color-saffron)_30%,var(--color-deep))] dark:text-saffron",
  error:
    "border-[color-mix(in_oklab,var(--color-destructive)_50%,white)] bg-[color-mix(in_oklab,var(--color-destructive)_14%,white)] text-[color-mix(in_oklab,var(--color-destructive)_40%,var(--color-deep))] dark:border-[color-mix(in_oklab,var(--color-destructive)_50%,transparent)] dark:bg-[color-mix(in_oklab,var(--color-destructive)_18%,var(--color-deep))] dark:text-[color-mix(in_oklab,var(--color-destructive)_55%,white)]",
  success:
    "border-[color-mix(in_oklab,var(--color-tulsi)_55%,white)] bg-[color-mix(in_oklab,var(--color-tulsi)_18%,white)] text-[color-mix(in_oklab,var(--color-tulsi)_50%,var(--color-deep))] dark:border-[color-mix(in_oklab,var(--color-tulsi)_55%,transparent)] dark:bg-[color-mix(in_oklab,var(--color-tulsi)_20%,var(--color-deep))] dark:text-[color-mix(in_oklab,var(--color-tulsi)_60%,white)]",
  destructive:
    "border-[color-mix(in_oklab,var(--color-destructive)_50%,white)] bg-[color-mix(in_oklab,var(--color-destructive)_14%,white)] text-[color-mix(in_oklab,var(--color-destructive)_40%,var(--color-deep))] dark:border-[color-mix(in_oklab,var(--color-destructive)_50%,transparent)] dark:bg-[color-mix(in_oklab,var(--color-destructive)_18%,var(--color-deep))] dark:text-[color-mix(in_oklab,var(--color-destructive)_55%,white)]",
};

export const feedbackIconClasses: Record<FeedbackVariant, string> = {
  info: "text-brass",
  warning: "text-saffron-dark",
  error: "text-destructive",
  success: "text-tulsi",
  destructive: "text-destructive",
};
