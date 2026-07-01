import { runIntentQuery, type StructuredQuery } from "../../src/domain/intentQuery";
import type { Place } from "../../src/domain/types";

function place(p: Partial<Place> & { placeId: string }): Place {
  return { name: p.placeId, lat: 0, lng: 0, cuisines: [], ...p };
}

test("cuisine filter keeps only intersecting places", () => {
  const places = [
    place({ placeId: "a", cuisines: ["Italian"], rating: 4.5, userRatingCount: 300 }),
    place({ placeId: "b", cuisines: ["Thai"], rating: 4.5, userRatingCount: 300 }),
  ];
  const q: StructuredQuery = { queryHint: "x", cuisines: ["Italian"] };
  expect(runIntentQuery(places, q).results.map((r) => r.place.placeId)).toEqual(["a"]);
});

test("price band is soft: an out-of-band place is kept, just ranked lower", () => {
  const places = [
    place({ placeId: "cheap", priceLevel: "PRICE_LEVEL_INEXPENSIVE", rating: 4.5, userRatingCount: 300 }),
    place({ placeId: "pricey", priceLevel: "PRICE_LEVEL_VERY_EXPENSIVE", rating: 4.5, userRatingCount: 300 }),
  ];
  const q: StructuredQuery = { queryHint: "x", priceBand: { min: 3 } };
  const ids = runIntentQuery(places, q).results.map((r) => r.place.placeId);
  expect(ids).toContain("cheap");          // never dropped
  expect(ids[0]).toBe("pricey");           // in-band ranks first
});

test("unpriced places are kept when a price band is set", () => {
  const places = [place({ placeId: "unpriced", rating: 4.5, userRatingCount: 300 })];
  const q: StructuredQuery = { queryHint: "x", priceBand: { min: 3 } };
  expect(runIntentQuery(places, q).results.map((r) => r.place.placeId)).toEqual(["unpriced"]);
});

test("density-scaled quality drops noise (tiny review count) but keeps modest-but-real", () => {
  const places = [
    place({ placeId: "noise", rating: 4.9, userRatingCount: 8 }),
    place({ placeId: "modest", rating: 4.3, userRatingCount: 300 }),
    place({ placeId: "popular", rating: 4.5, userRatingCount: 900 }),
  ];
  const q: StructuredQuery = { queryHint: "x" };
  const ids = runIntentQuery(places, q).results.map((r) => r.place.placeId);
  expect(ids).not.toContain("noise");      // 8 reviews is below 10% of the median
  expect(ids).toEqual(expect.arrayContaining(["modest", "popular"]));
});

test("a guide award overrides the quality floor and ranks first", () => {
  const places = [
    place({ placeId: "hatted", rating: 4.2, userRatingCount: 8, guideAward: "Good Food · 1 Hat" }),
    place({ placeId: "modest", rating: 4.3, userRatingCount: 300 }),
    place({ placeId: "popular", rating: 4.6, userRatingCount: 900 }),
  ];
  const q: StructuredQuery = { queryHint: "x", prestige: ["guide"] };
  const ids = runIntentQuery(places, q).results.map((r) => r.place.placeId);
  expect(ids).toContain("hatted");         // not dropped despite 8 reviews
  expect(ids[0]).toBe("hatted");           // guide boost puts it first
});

test("top prestige orders by rating (best first)", () => {
  const places = [
    place({ placeId: "good", rating: 4.2, userRatingCount: 300 }),
    place({ placeId: "best", rating: 4.8, userRatingCount: 300 }),
    place({ placeId: "ok", rating: 4.0, userRatingCount: 300 }),
  ];
  const q: StructuredQuery = { queryHint: "x", prestige: ["top"] };
  expect(runIntentQuery(places, q).results.map((r) => r.place.placeId)).toEqual(["best", "good", "ok"]);
});

test("hidden-gem prestige nudges a high-rated low-count place above a high-count peer", () => {
  const places = [
    place({ placeId: "gem", rating: 4.6, userRatingCount: 40 }),
    place({ placeId: "crowd", rating: 4.6, userRatingCount: 950 }),
  ];
  const q: StructuredQuery = { queryHint: "x", prestige: ["hidden-gem"] };
  expect(runIntentQuery(places, q).results[0].place.placeId).toBe("gem");
});

test("dietary is keep-and-label: non-matching places stay but are flagged unconfirmed", () => {
  const places = [
    place({ placeId: "veg", dietaryTags: ["vegetarian"], rating: 4.4, userRatingCount: 300 }),
    place({ placeId: "unknown", rating: 4.4, userRatingCount: 300 }),
  ];
  const q: StructuredQuery = { queryHint: "x", dietary: ["vegetarian"] };
  const out = runIntentQuery(places, q).results;
  expect(out.map((r) => r.place.placeId)).toEqual(expect.arrayContaining(["veg", "unknown"]));
  expect(out.find((r) => r.place.placeId === "veg")!.unconfirmed).toEqual([]);
  expect(out.find((r) => r.place.placeId === "unknown")!.unconfirmed).toEqual(["vegetarian"]);
});

test("relaxation ladder reports cuisine, not quality, when cuisine is the true blocker", () => {
  // "a" has a healthy review count, so the quality floor never removes it. Only the cuisine
  // filter empties the set, so cuisine (not quality) must be reported as the relaxed constraint.
  const places = [place({ placeId: "a", cuisines: ["Thai"], rating: 4.5, userRatingCount: 300 })];
  const q: StructuredQuery = { queryHint: "x", cuisines: ["Italian"] };
  const out = runIntentQuery(places, q);
  expect(out.results.map((r) => r.place.placeId)).toEqual(["a"]);
  expect(out.relaxed).toEqual(["cuisine"]);
});

test("the density floor never empties a non-empty set, so nothing is relaxed", () => {
  // "tiny" is below 10% of the median (2502.5) and is dropped, but the median-count place always
  // clears the floor, so results stay non-empty and no relaxation is reported.
  const places = [
    place({ placeId: "tiny", cuisines: ["Thai"], rating: 4.1, userRatingCount: 5 }),
    place({ placeId: "huge", cuisines: ["Thai"], rating: 4.1, userRatingCount: 5000 }),
  ];
  const q: StructuredQuery = { queryHint: "x", cuisines: ["Thai"] };
  const out = runIntentQuery(places, q);
  expect(out.relaxed).toEqual([]);
  expect(out.results.map((r) => r.place.placeId)).toEqual(["huge"]);
});
