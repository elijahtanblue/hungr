import type { OpeningPeriod } from "../api/placeDetails";

// Compact opening-hours formatting from Google's structured periods: 24-hour times and short day
// names, so the hours block stays small. Google numbers days 0 (Sunday) to 6 (Saturday).

const SHORT_DAY = ["Sun", "Mon", "Tues", "Wed", "Thurs", "Fri", "Sat"];
// Display order Monday first, matching how people read a week.
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

function hhmm(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

// All ranges that START on a given day, as "HH:MM-HH:MM" strings. A period with no close is a
// 24-hour day. Uses an en-dash between times.
function rangesForDay(periods: OpeningPeriod[], day: number): string {
  const onDay = periods.filter((p) => p.open?.day === day);
  if (onDay.length === 0) return "Closed";
  const parts = onDay.map((p) => {
    if (!p.close) return "Open 24 hours";
    return `${hhmm(p.open.hour, p.open.minute)}–${hhmm(p.close.hour, p.close.minute)}`;
  });
  return parts.join(", ");
}

export function shortDayName(day: number): string {
  return SHORT_DAY[day] ?? "";
}

export type DayHours = { day: string; hours: string };

// One compact line per day, Monday first, for the detail page.
export function formatWeekHours(periods: OpeningPeriod[] | undefined): DayHours[] {
  if (!periods || periods.length === 0) return [];
  return DISPLAY_ORDER.map((day) => ({ day: SHORT_DAY[day], hours: rangesForDay(periods, day) }));
}

// Today's hours for the card, picked from the device's current day so it always matches "now".
export function todaysHours(periods: OpeningPeriod[] | undefined, now: Date = new Date()): string | null {
  if (!periods || periods.length === 0) return null;
  return rangesForDay(periods, now.getDay());
}
