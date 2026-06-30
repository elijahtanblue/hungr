import { spreadOverlappingPins } from "../../src/domain/spreadPins";
import type { Place } from "../../src/domain/types";

const place = (placeId: string, lat: number, lng: number): Place => ({
  placeId, name: placeId, lat, lng, cuisines: [],
});

test("leaves a lone pin exactly where it is", () => {
  const input = [place("a", -33.87, 151.21)];
  expect(spreadOverlappingPins(input)).toEqual(input);
});

test("fans out pins that share a coordinate so each is tappable", () => {
  const input = [place("a", -33.87, 151.21), place("b", -33.87, 151.21)];
  const out = spreadOverlappingPins(input);

  expect(out).toHaveLength(2);
  // Both originals are still present (matched by id), order preserved.
  expect(out.map((p) => p.placeId)).toEqual(["a", "b"]);
  // They no longer share a coordinate.
  expect(out[0].lat === out[1].lat && out[0].lng === out[1].lng).toBe(false);
  // The shift is small (well under ~50m), so a pin still reads as "here".
  expect(Math.abs(out[0].lat - -33.87)).toBeLessThan(0.0005);
  expect(Math.abs(out[0].lng - 151.21)).toBeLessThan(0.0005);
});

test("does not disturb pins that are merely near each other", () => {
  const input = [place("a", -33.87, 151.21), place("b", -33.88, 151.22)];
  expect(spreadOverlappingPins(input)).toEqual(input);
});

test("preserves every non-coordinate field", () => {
  const input: Place[] = [
    { placeId: "a", name: "A", lat: 1, lng: 1, cuisines: ["Thai"], rating: 4.5, state: "loved" },
    { placeId: "b", name: "B", lat: 1, lng: 1, cuisines: ["Thai"], rating: 4.0, state: "liked" },
  ];
  const out = spreadOverlappingPins(input);
  expect(out[0]).toMatchObject({ placeId: "a", name: "A", cuisines: ["Thai"], rating: 4.5, state: "loved" });
  expect(out[1]).toMatchObject({ placeId: "b", name: "B", cuisines: ["Thai"], rating: 4.0, state: "liked" });
});
