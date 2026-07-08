const DIMENSION_TIMEOUT_MS = 10_000;

export function setDimensionTimeout(ms: number): void {
  // Override for tests — reassign the constant via this setter since
  // modules are cached. Called before import in test setup.
  (globalThis as Record<string, unknown>).__DIMENSION_TIMEOUT_MS__ = ms;
}

function getTimeout(): number {
  return ((globalThis as Record<string, unknown>).__DIMENSION_TIMEOUT_MS__ as number) ?? DIMENSION_TIMEOUT_MS;
}

export function getImageDimensions(
  file: File,
): Promise<{ width: number; height: number } | null> {
  if (!file.type.startsWith("image/")) return Promise.resolve(null);
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    let timer: ReturnType<typeof setTimeout> | undefined;
    function finish(result: { width: number; height: number } | null) {
      if (timer !== undefined) clearTimeout(timer);
      URL.revokeObjectURL(url);
      resolve(result);
    }
    timer = setTimeout(() => finish(null), getTimeout());
    img.onload = () => finish({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => finish(null);
    img.src = url;
  });
}
