/** Review palettes; saffron is the production default selected for the bright redesign. */
export const DESIGN_PALETTES = {
  tulsi: { background: "#FAFAF6", foreground: "#252D28", card: "#FFFFFF", primary: "#355A46", "primary-hover": "#274535", "primary-foreground": "#FFFFFF", secondary: "#EAF0E8", "muted-foreground": "#535E55", border: "#D5DCD2", input: "#7E8D80", ring: "#355A46", "brand-brass-light": "#D6E2D0" },
  saffron: { background: "#FFFEFC", foreground: "#292622", card: "#FFFFFF", primary: "#B65316", "primary-hover": "#94400D", "primary-foreground": "#FFFFFF", secondary: "#FFF3E8", "muted-foreground": "#6A625B", border: "#E5E1DA", input: "#948B81", ring: "#B65316", "brand-brass-light": "#F3D4BA" },
  amber: { background: "#FFFFFF", foreground: "#302921", card: "#FFFFFF", primary: "#996112", "primary-hover": "#774708", "primary-foreground": "#FFFFFF", secondary: "#FFF5E6", "muted-foreground": "#6A6055", border: "#E6DFD3", input: "#938574", ring: "#996112", "brand-brass-light": "#F0DDBB" },
  terracotta: { background: "#FFFCFA", foreground: "#302725", card: "#FFFFFF", primary: "#A9472B", "primary-hover": "#84341E", "primary-foreground": "#FFFFFF", secondary: "#FFF0E9", "muted-foreground": "#6C605A", border: "#E7DDD7", input: "#97877E", ring: "#A9472B", "brand-brass-light": "#F0D1C3" },
  indigo: { background: "#F6F7FB", foreground: "#292D40", card: "#FFFFFF", primary: "#505B89", "primary-hover": "#3D476F", "primary-foreground": "#FFFFFF", secondary: "#E9ECF5", "muted-foreground": "#596077", border: "#D4D8E5", input: "#858DA5", ring: "#505B89", "brand-brass-light": "#CDD3ED" },
} as const;
export type DesignPalette = keyof typeof DESIGN_PALETTES;
