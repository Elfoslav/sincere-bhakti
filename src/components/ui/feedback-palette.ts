export type FeedbackVariant = "info" | "warning" | "error" | "success" | "destructive";

/** Blend feedback into the current surface, keeping text readable in both themes. */
const destructiveFeedbackClasses = "border-destructive/30 bg-[color-mix(in_srgb,var(--destructive)_8%,var(--card))] text-foreground";

export const feedbackContainerClasses: Record<FeedbackVariant, string> = {
  info:
    "border-primary/30 bg-[color-mix(in_srgb,var(--primary)_8%,var(--card))] text-foreground",
  warning:
    "border-primary/40 bg-[color-mix(in_srgb,var(--primary)_14%,var(--card))] text-foreground",
  error: destructiveFeedbackClasses,
  success:
    "border-tulsi/30 bg-[color-mix(in_srgb,var(--success)_8%,var(--card))] text-foreground",
  destructive: destructiveFeedbackClasses,
};

export const feedbackIconClasses: Record<FeedbackVariant, string> = {
  info: "text-brass",
  warning: "text-saffron-dark",
  error: "text-destructive",
  success: "text-tulsi",
  destructive: "text-destructive",
};
