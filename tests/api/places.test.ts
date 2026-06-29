import { applyFilters, searchNearby } from "../../src/api/places";
import type { Place } from "../../src/domain/types";
import { supabase } from "../../src/lib/supabase";

jest.mock("../../src/lib/supabase", () => ({
  supabase: { functions: { invoke: jest.fn() } },
}));

const places: Place[] = [
  { placeId: "a", name: "Chinese A", lat: 0, lng: 0, cuisines: ["Chinese"] },
  { placeId: "b", name: "Indian B", lat: 0, lng: 0, cuisines: ["Indian"] },
  { placeId: "c", name: "Mixed C", lat: 0, lng: 0, cuisines: ["Indian", "Chinese"] },
];

test("applyFilters hides places whose every cuisine is suppressed", () => {
  const out = applyFilters(places, { suppressed: ["Indian"], selected: [] });
  expect(out.map((p) => p.placeId)).toEqual(["a", "c"]); // b hidden, c stays (also Chinese)
});

test("applyFilters with a selected cuisine keeps only matching places", () => {
  const out = applyFilters(places, { suppressed: [], selected: ["Chinese"] });
  expect(out.map((p) => p.placeId)).toEqual(["a", "c"]);
});

test("searchNearby carries the coarse cuisine returned by the proxy", async () => {
  (supabase.functions.invoke as jest.Mock).mockResolvedValue({
    data: { places: [{ placeId: "x", name: "X", lat: 1, lng: 2, rating: 4.5, cuisines: ["Thai"] }] },
    error: null,
  });
  const out = await searchNearby(1, 2, "food");
  expect(out[0].cuisines).toEqual(["Thai"]);
});
