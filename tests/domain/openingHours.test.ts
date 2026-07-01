import { formatWeekHours, todaysHours } from "../../src/domain/openingHours";
import type { OpeningPeriod } from "../../src/api/placeDetails";

// Mon-Fri 9-21, Sat 9-19, Sun closed.
const WEEK: OpeningPeriod[] = [
  { open: { day: 1, hour: 9, minute: 0 }, close: { day: 1, hour: 21, minute: 0 } },
  { open: { day: 2, hour: 9, minute: 0 }, close: { day: 2, hour: 21, minute: 0 } },
  { open: { day: 3, hour: 9, minute: 0 }, close: { day: 3, hour: 21, minute: 0 } },
  { open: { day: 4, hour: 9, minute: 0 }, close: { day: 4, hour: 21, minute: 0 } },
  { open: { day: 5, hour: 9, minute: 0 }, close: { day: 5, hour: 21, minute: 0 } },
  { open: { day: 6, hour: 9, minute: 0 }, close: { day: 6, hour: 19, minute: 0 } },
];

test("formats a compact week with short day names and 24h times, Monday first", () => {
  expect(formatWeekHours(WEEK)).toEqual([
    { day: "Mon", hours: "09:00–21:00" },
    { day: "Tues", hours: "09:00–21:00" },
    { day: "Wed", hours: "09:00–21:00" },
    { day: "Thurs", hours: "09:00–21:00" },
    { day: "Fri", hours: "09:00–21:00" },
    { day: "Sat", hours: "09:00–19:00" },
    { day: "Sun", hours: "Closed" },
  ]);
});

test("today's hours follow the device day", () => {
  // 2026-07-01 is a Wednesday.
  expect(todaysHours(WEEK, new Date("2026-07-01T12:00:00"))).toBe("09:00–21:00");
  // 2026-07-05 is a Sunday.
  expect(todaysHours(WEEK, new Date("2026-07-05T12:00:00"))).toBe("Closed");
});

test("a 24-hour day reads as Open 24 hours", () => {
  const allDay: OpeningPeriod[] = [{ open: { day: 1, hour: 0, minute: 0 } }];
  expect(todaysHours(allDay, new Date("2026-06-29T08:00:00"))).toBe("Open 24 hours"); // Monday
});

test("multiple ranges in a day are joined", () => {
  const split: OpeningPeriod[] = [
    { open: { day: 3, hour: 11, minute: 30 }, close: { day: 3, hour: 14, minute: 0 } },
    { open: { day: 3, hour: 17, minute: 0 }, close: { day: 3, hour: 22, minute: 0 } },
  ];
  expect(todaysHours(split, new Date("2026-07-01T12:00:00"))).toBe("11:30–14:00, 17:00–22:00");
});

test("no periods yields nothing", () => {
  expect(formatWeekHours(undefined)).toEqual([]);
  expect(todaysHours([], new Date())).toBeNull();
});
