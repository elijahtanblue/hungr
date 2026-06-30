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

test("searchNearby carries the coarse cuisine returned by the proxy", async () => {
  (supabase.functions.invoke as jest.Mock).mockResolvedValue({
    data: { places: [{ placeId: "x", name: "X", lat: 1, lng: 2, rating: 4.5, cuisines: ["Thai"] }] },
    error: null,
  });
  const out = await searchNearby(1, 2, "food");
  expect(out[0].cuisines).toEqual(["Thai"]);
});

test("searchNearby follows page tokens and dedupes Places results", async () => {
  (supabase.functions.invoke as jest.Mock)
    .mockResolvedValueOnce({
      data: {
        places: [
          { placeId: "a", name: "A", lat: 1, lng: 2, cuisines: ["Thai"] },
          { placeId: "b", name: "B", lat: 3, lng: 4, cuisines: ["Chinese"] },
        ],
        nextPageToken: "next-1",
      },
      error: null,
    })
    .mockResolvedValueOnce({
      data: {
        places: [
          { placeId: "b", name: "B updated", lat: 3, lng: 4, cuisines: ["Chinese", "Asian"] },
          { placeId: "c", name: "C", lat: 5, lng: 6, cuisines: ["Italian"] },
        ],
      },
      error: null,
    });

  const out = await searchNearby(1, 2, "food");

  expect(supabase.functions.invoke).toHaveBeenNthCalledWith(1, "places-proxy", {
    body: { lat: 1, lng: 2, query: "food" },
  });
  expect(supabase.functions.invoke).toHaveBeenNthCalledWith(2, "places-proxy", {
    body: { lat: 1, lng: 2, query: "food", pageToken: "next-1" },
  });
  expect(out.map((p) => p.placeId)).toEqual(["a", "b", "c"]);
  expect(out.find((p) => p.placeId === "b")!.name).toBe("B updated");
});

test("mergePlaces keeps existing pins and preserves first party state", () => {
  const out = mergePlaces(
    [{ placeId: "a", name: "Old", lat: 1, lng: 2, cuisines: ["Thai"], state: "been" }],
    [
      { placeId: "a", name: "Fresh", lat: 1, lng: 2, cuisines: ["Thai", "Asian"] },
      { placeId: "b", name: "New", lat: 3, lng: 4, cuisines: ["Italian"] },
    ],
  );

  expect(out.map((p) => p.placeId)).toEqual(["a", "b"]);
  expect(out[0]).toEqual(expect.objectContaining({ name: "Fresh", state: "been" }));
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
        data: [{ place_id: "a", state: "been" }],
        error: null,
      }),
    }),
  });

  const out = await withUserPlaceStates(places);

  expect(out.find((p) => p.placeId === "a")!.state).toBe("been");
  expect(out.find((p) => p.placeId === "b")!.state).toBeUndefined();
});

test("withUserPlaceStates is best effort when signed out", async () => {
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: null }, error: null });

  await expect(withUserPlaceStates(places)).resolves.toEqual(places);
});
