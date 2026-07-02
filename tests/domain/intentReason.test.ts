import { intentReason } from "../../src/domain/intentReason";
import type { Place } from "../../src/domain/types";
import type { IntentResult, StructuredQuery } from "../../src/domain/intentQuery";

const place = (over: Partial<Place>): Place => ({
  placeId: "p", name: "Spot", lat: 0, lng: 0, cuisines: [], ...over,
});
const result = (over: Partial<Place>, unconfirmed: string[] = []): IntentResult => ({
  place: place(over), unconfirmed,
});

test("a guide award is the strongest reason", () => {
  const q: StructuredQuery = { queryHint: "x", prestige: ["guide", "top"] };
  expect(intentReason(result({ guideAward: "Michelin · 1 Star", rating: 4.8 }), q)).toBe("Michelin · 1 Star");
});

test("hidden-gem intent surfaces the under-the-radar line", () => {
  const q: StructuredQuery = { queryHint: "x", prestige: ["hidden-gem"] };
  expect(intentReason(result({ rating: 4.7, userRatingCount: 40 }), q)).toBe("Under-the-radar find");
});

test("top intent cites the numeric rating", () => {
  const q: StructuredQuery = { queryHint: "x", prestige: ["top"] };
  expect(intentReason(result({ rating: 4.6 }), q)).toBe("Highly rated (4.6★)");
});

test("cuisine match is named when no prestige applies", () => {
  const q: StructuredQuery = { queryHint: "x", cuisines: ["italian"] };
  expect(intentReason(result({ cuisines: ["italian"] }), q)).toBe("Italian spot");
});

test("dietary caveat is appended honestly for unconfirmed flags", () => {
  const q: StructuredQuery = { queryHint: "x", cuisines: ["thai"], dietary: ["vegan"] };
  expect(intentReason(result({ cuisines: ["thai"] }, ["vegan"]), q)).toBe("Thai spot · vegan not confirmed");
});

test("falls back to a neutral line with nothing to cite", () => {
  expect(intentReason(result({}), { queryHint: "x" })).toBe("Worth a look");
});
