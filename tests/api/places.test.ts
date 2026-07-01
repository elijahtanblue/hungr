import { applyFilters, mergePlaces, searchNearby, withFirstPartyCuisines, withUserPlaceStates } from "../../src/api/places";
import type { Place } from "../../src/domain/types";
import { supabase } from "../../src/lib/supabase";

jest.mock("../../src/lib/supabase", () => ({
  supabase: {
    auth: { getUser: jest.fn() },
    functions: { invoke: jest.fn() },
    from: jest.fn(),
  },
}));

const places: Place[] = [
  { placeId: "a", name: "Chinese A", lat: 0, lng: 0, cuisines: ["Chinese"] },
  { placeId: "b", name: "Indian B", lat: 0, lng: 0, cuisines: ["Indian"] },
  { placeId: "c", name: "Mixed C", lat: 0, lng: 0, cuisines: ["Indian", "Chinese"] },
];

beforeEach(() => {
  jest.clearAllMocks();
});

test("applyFilters hides places whose every cuisine is suppressed", () => {
  const out = applyFilters(places, { suppressed: ["Indian"], selected: [] });
  expect(out.map((p) => p.placeId)).toEqual(["a", "c"]); // b hidden, c stays (also Chinese)
});

test("applyFilters with a selected cuisine keeps only matching places", () => {
  const out = applyFilters(places, { suppressed: [], selected: ["Chinese"] });
  expect(out.map((p) => p.placeId)).toEqual(["a", "c"]);
});

test("applyFilters applies budget, distance, show-state, and sorting controls", () => {
  const rich: Place[] = [
    { placeId: "cheap-far", name: "Cheap Far", lat: 0, lng: 0, cuisines: ["Thai"], rating: 4.9, priceLevel: "PRICE_LEVEL_INEXPENSIVE", distanceMeters: 4000, state: "liked" },
    { placeId: "mid-near", name: "Mid Near", lat: 0, lng: 0, cuisines: ["Thai"], rating: 4.2, priceLevel: "PRICE_LEVEL_MODERATE", distanceMeters: 1200, state: "liked" },
    { placeId: "expensive-near", name: "Expensive Near", lat: 0, lng: 0, cuisines: ["Thai"], rating: 4.8, priceLevel: "PRICE_LEVEL_EXPENSIVE", distanceMeters: 800, state: "liked" },
    { placeId: "saved-near", name: "Saved Near", lat: 0, lng: 0, cuisines: ["Thai"], rating: 5, priceLevel: "PRICE_LEVEL_INEXPENSIVE", distanceMeters: 500, state: "go" },
  ];

  const out = applyFilters(rich, {
    selected: [],
    suppressed: [],
    budgetMax: 2,
    withinKm: 2,
    sortBy: "distance",
    showState: "liked",
  });

  expect(out.map((p) => p.placeId)).toEqual(["mid-near"]);
});

test("applyFilters hides places below the minimum rating", () => {
  const rich: Place[] = [
    { placeId: "top", name: "Top", lat: 0, lng: 0, cuisines: ["Thai"], rating: 4.6 },
    { placeId: "mid", name: "Mid", lat: 0, lng: 0, cuisines: ["Thai"], rating: 4.1 },
    { placeId: "unrated", name: "Unrated", lat: 0, lng: 0, cuisines: ["Thai"] },
  ];

  const out = applyFilters(rich, { selected: [], suppressed: [], minRating: 4.5 });

  expect(out.map((p) => p.placeId)).toEqual(["top"]);
});

test("searchNearby carries the coarse cuisine returned by the proxy", async () => {
  (supabase.functions.invoke as jest.Mock).mockResolvedValue({
    data: { places: [{ placeId: "x", name: "X", lat: 1.01, lng: 2.01, rating: 4.5, priceLevel: "PRICE_LEVEL_MODERATE", cuisines: ["Thai"], photoName: "places/x/photos/abc" }] },
    error: null,
  });
  const out = await searchNearby(1, 2, "food");
  expect(out[0].cuisines).toEqual(["Thai"]);
  expect(out[0].priceLevel).toBe("PRICE_LEVEL_MODERATE");
  expect(out[0].photoName).toBe("places/x/photos/abc");
  expect(out[0].distanceMeters).toBeGreaterThan(0);
});

test("searchNearby carries userRatingCount from the proxy", async () => {
  (supabase.functions.invoke as jest.Mock).mockResolvedValue({
    data: { places: [{ placeId: "x", name: "X", lat: 1.01, lng: 2.01, rating: 4.5, userRatingCount: 320, cuisines: ["Thai"] }] },
    error: null,
  });
  const out = await searchNearby(1, 2, "food");
  expect(out[0].userRatingCount).toBe(320);
});

test("searchNearby derives first-party dietary tags from the place name", async () => {
  (supabase.functions.invoke as jest.Mock).mockResolvedValue({
    data: { places: [
      { placeId: "veg", name: "Gigi's Vegetarian", lat: 1.01, lng: 2.01, cuisines: ["Italian"] },
      { placeId: "steak", name: "Joe's Steakhouse", lat: 1.02, lng: 2.02, cuisines: ["Steakhouse"] },
    ] },
    error: null,
  });
  const out = await searchNearby(1, 2, "food");
  expect(out.find((p) => p.placeId === "veg")!.dietaryTags).toEqual(["vegetarian"]);
  expect(out.find((p) => p.placeId === "steak")!.dietaryTags).toBeUndefined();
});

test("searchNearby forwards a selected search radius to the proxy", async () => {
  (supabase.functions.invoke as jest.Mock).mockResolvedValue({ data: { places: [] }, error: null });

  await searchNearby(1, 2, "food", { radiusMeters: 10000 });

  expect(supabase.functions.invoke).toHaveBeenCalledWith("places-proxy", {
    body: { lat: 1, lng: 2, query: "food", radiusMeters: 10000 },
  });
});

test("searchNearby fetches a single page for a fast first paint", async () => {
  (supabase.functions.invoke as jest.Mock).mockResolvedValue({
    data: {
      places: [
        { placeId: "a", name: "A", lat: 1, lng: 2, cuisines: ["Thai"] },
        { placeId: "b", name: "B", lat: 3, lng: 4, cuisines: ["Chinese"] },
      ],
      nextPageToken: "next-1",
    },
    error: null,
  });

  const out = await searchNearby(1, 2, "food");

  // Only one round trip, and we do not follow the page token (extra pages were the slow path).
  expect(supabase.functions.invoke).toHaveBeenCalledTimes(1);
  expect(supabase.functions.invoke).toHaveBeenCalledWith("places-proxy", {
    body: { lat: 1, lng: 2, query: "food" },
  });
  expect(out.map((p) => p.placeId)).toEqual(["a", "b"]);
});

test("searchNearbyPage returns one page plus the token to load the next", async () => {
  (supabase.functions.invoke as jest.Mock).mockResolvedValue({
    data: { places: [{ placeId: "a", name: "A", lat: 1, lng: 2, cuisines: ["Thai"] }], nextPageToken: "next-1" },
    error: null,
  });

  const { searchNearbyPage } = require("../../src/api/places");
  const out = await searchNearbyPage(1, 2, "food", { openNow: true, pageToken: "tok" });

  expect(supabase.functions.invoke).toHaveBeenCalledWith("places-proxy", {
    body: { lat: 1, lng: 2, query: "food", openNow: true, pageToken: "tok" },
  });
  expect(out.places.map((p: any) => p.placeId)).toEqual(["a"]);
  expect(out.nextPageToken).toBe("next-1");
});

test("mergePlaces keeps existing pins and preserves first party state", () => {
  const out = mergePlaces(
    [{ placeId: "a", name: "Old", lat: 1, lng: 2, cuisines: ["Thai"], state: "liked" }],
    [
      { placeId: "a", name: "Fresh", lat: 1, lng: 2, cuisines: ["Thai", "Asian"] },
      { placeId: "b", name: "New", lat: 3, lng: 4, cuisines: ["Italian"] },
    ],
  );

  expect(out.map((p) => p.placeId)).toEqual(["a", "b"]);
  expect(out[0]).toEqual(expect.objectContaining({ name: "Fresh", state: "liked" }));
});

test("searchNearby drops malformed places that cannot render on the map", async () => {
  (supabase.functions.invoke as jest.Mock).mockResolvedValue({
    data: {
      places: [
        { placeId: "ok", name: "OK", lat: 1, lng: 2, cuisines: [] },
        { placeId: "bad", name: "Bad", lat: undefined, lng: 2, cuisines: [] },
      ],
    },
    error: null,
  });
  const out = await searchNearby(1, 2, "food");
  expect(out.map((p) => p.placeId)).toEqual(["ok"]);
});

test("searchNearby rejects when the proxy returns no places payload", async () => {
  (supabase.functions.invoke as jest.Mock).mockResolvedValue({ data: null, error: null });
  await expect(searchNearby(1, 2, "food")).rejects.toThrow("Invalid places response");
});

test("withFirstPartyCuisines is best effort: a refinement failure falls back to base cuisines, never wiping pins", async () => {
  (supabase.from as jest.Mock).mockReturnValue({
    select: jest.fn().mockReturnValue({
      in: jest.fn().mockResolvedValue({ data: null, error: new Error("rls denied") }),
    }),
  });
  // Optional enrichment: on error it returns the input places unchanged rather than throwing,
  // so the map keeps its pins (a throw here would be caught upstream and clear the whole map).
  const out = await withFirstPartyCuisines(places);
  expect(out).toEqual(places);
});

test("withFirstPartyCuisines unions first party tags whether the relation is an object or an array", async () => {
  (supabase.from as jest.Mock).mockReturnValue({
    select: jest.fn().mockReturnValue({
      in: jest.fn().mockResolvedValue({
        data: [
          { place_id: "a", cuisines: { name: "Sichuan" } },        // to-one object shape
          { place_id: "b", cuisines: [{ name: "Punjabi" }] },       // array shape
        ],
        error: null,
      }),
    }),
  });
  const out = await withFirstPartyCuisines(places);
  expect(out.find((p) => p.placeId === "a")!.cuisines).toEqual(expect.arrayContaining(["Chinese", "Sichuan"]));
  expect(out.find((p) => p.placeId === "b")!.cuisines).toEqual(expect.arrayContaining(["Indian", "Punjabi"]));
});

test("withUserPlaceStates restores saved states after a fresh Google search", async () => {
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
  (supabase.from as jest.Mock).mockReturnValue({
    select: jest.fn().mockReturnValue({
      in: jest.fn().mockResolvedValue({
        data: [{ place_id: "a", state: "liked" }],
        error: null,
      }),
    }),
  });

  const out = await withUserPlaceStates(places);

  expect(out.find((p) => p.placeId === "a")!.state).toBe("liked");
  expect(out.find((p) => p.placeId === "b")!.state).toBeUndefined();
});

test("withUserPlaceStates is best effort when signed out", async () => {
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: null }, error: null });

  await expect(withUserPlaceStates(places)).resolves.toEqual(places);
});
