/** Token names only: values live in globals.css so the gallery cannot drift. */
export const DESIGN_COLOR_TOKENS = [
  "background", "foreground", "card", "primary", "primary-foreground",
  "secondary", "muted", "muted-foreground", "border", "input", "ring",
  "destructive", "destructive-foreground", "success",
] as const;

export const DESIGN_SPACING_STEPS = [1, 2, 3, 4, 6, 8, 12, 16] as const;
