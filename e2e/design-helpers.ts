import { type Page } from "@playwright/test";

/** Capture unexpected app errors without suppressing analytics or hydration failures. */
export function observeDesignErrors(page: Page, { expectedDocument404 = false } = {}): string[] {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (expectedDocument404 && message.location().url === page.url() && text === "Failed to load resource: the server responded with a status of 404 (Not Found)") return;
    errors.push(text);
  });
  return errors;
}

/** Resolve modern CSS color formats through canvas before computing contrast. */
export async function measureTextContrast(page: Page, pairs: Array<{ foreground: string; background: string }>): Promise<number[]> {
  return page.evaluate(colors => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d")!;
    const luminance = (color: string) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      const [r, g, b] = Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3).map(value => {
        const channel = value / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return r * 0.2126 + g * 0.7152 + b * 0.0722;
    };
    return colors.map(({ foreground, background }) => {
      const a = luminance(foreground), b = luminance(background);
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    });
  }, pairs);
}
