export function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function generateShortId(): string {
  return crypto.randomUUID().slice(0, 8);
}
