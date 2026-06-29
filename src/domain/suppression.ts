// A place is hidden only when every one of its cuisines is in the suppressed list.
// Suppressing "Thai" never hides a place that is also "Chinese".
export function isSuppressed(placeCuisines: string[], suppressed: string[]): boolean {
  if (placeCuisines.length === 0 || suppressed.length === 0) return false;
  const blocked = new Set(suppressed);
  return placeCuisines.every((c) => blocked.has(c));
}
