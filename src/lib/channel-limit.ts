export const DEFAULT_MAX_CHANNELS_PER_USER = 10;

function parseNonNegativeInteger(value: string | undefined): number | null {
  if (value === undefined) return null;
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) return null;
  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed < 0) return null;
  return parsed;
}

export function getMaxChannelsPerUser(): number {
  return parseNonNegativeInteger(process.env.MAX_CHANNELS_PER_USER) ?? DEFAULT_MAX_CHANNELS_PER_USER;
}
