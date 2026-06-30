export function formatRating(value: number): string {
  return (Math.round(value * 10) / 10).toFixed(1);
}
