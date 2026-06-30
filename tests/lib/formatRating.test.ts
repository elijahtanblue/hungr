import { formatRating } from "../../src/lib/formatRating";

test("formatRating always returns one decimal place", () => {
  expect(formatRating(4)).toBe("4.0");
  expect(formatRating(5)).toBe("5.0");
  expect(formatRating(4.5)).toBe("4.5");
  expect(formatRating(4.04)).toBe("4.0");
});
