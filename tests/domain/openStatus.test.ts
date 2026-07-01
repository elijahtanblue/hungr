import { openStatus, openStatusLabel } from "../../src/domain/openStatus";

const NOW = Date.parse("2026-07-01T12:00:00Z");

test("unknown when openNow is not provided", () => {
  expect(openStatus(undefined, undefined, NOW)).toBe("unknown");
});

test("closed when not open, regardless of close time", () => {
  expect(openStatus(false, "2026-07-01T13:00:00Z", NOW)).toBe("closed");
});

test("open when there is more than an hour until close", () => {
  expect(openStatus(true, "2026-07-01T14:00:00Z", NOW)).toBe("open");
});

test("closing-soon when it closes within the hour", () => {
  expect(openStatus(true, "2026-07-01T12:45:00Z", NOW)).toBe("closing-soon");
});

test("open when no close time is known", () => {
  expect(openStatus(true, undefined, NOW)).toBe("open");
});

test("a past close time is not treated as closing soon", () => {
  expect(openStatus(true, "2026-07-01T11:00:00Z", NOW)).toBe("open");
});

test("labels read naturally", () => {
  expect(openStatusLabel("open")).toBe("Open now");
  expect(openStatusLabel("closing-soon")).toBe("Closing soon");
  expect(openStatusLabel("closed")).toBe("Closed");
});
