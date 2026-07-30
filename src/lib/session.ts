export const AUTHENTICATED = "authenticated";

export function isAuthenticated(status: string): boolean {
  return status === AUTHENTICATED;
}
