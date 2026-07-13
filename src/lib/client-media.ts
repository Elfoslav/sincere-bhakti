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
    function cleanup() {
      URL.revokeObjectURL(url);
    }
    const timer = setTimeout(() => {
      cleanup();
      resolve(null);
    }, getTimeout());
    img.onload = () => {
      clearTimeout(timer);
      cleanup();
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      clearTimeout(timer);
      cleanup();
      resolve(null);
    };
    img.src = url;
  });
}
