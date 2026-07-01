// Turns Google's openNow flag plus the next closing time into a single display state, so the card
// can show a calm "Open now", a warning "Closing soon" (within an hour), or "Closed".
export type OpenStatus = "open" | "closing-soon" | "closed" | "unknown";

const CLOSING_SOON_MS = 60 * 60 * 1000;

export function openStatus(openNow?: boolean, nextCloseTime?: string, nowMs: number = Date.now()): OpenStatus {
  if (openNow === undefined) return "unknown";
  if (!openNow) return "closed";
  if (nextCloseTime) {
    const closeMs = Date.parse(nextCloseTime);
    if (Number.isFinite(closeMs) && closeMs > nowMs && closeMs - nowMs <= CLOSING_SOON_MS) {
      return "closing-soon";
    }
  }
  return "open";
}

export function openStatusLabel(status: OpenStatus): string {
  if (status === "open") return "Open now";
  if (status === "closing-soon") return "Closing soon";
  if (status === "closed") return "Closed";
  return "";
}
