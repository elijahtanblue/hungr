import { getPlaceGuides, guideBadgeLabel, annotateGuides } from "../../src/api/guides";
import { supabase } from "../../src/lib/supabase";
import type { Place } from "../../src/domain/types";

jest.mock("../../src/lib/supabase", () => ({ supabase: { rpc: jest.fn() } }));

beforeEach(() => jest.clearAllMocks());

test("getPlaceGuides maps rows by place id", async () => {
  (supabase.rpc as jest.Mock).mockResolvedValue({
    data: [{ place_id: "p1", guide: "Michelin", award: "1 Star", year: 2024 }],
    error: null,
  });
  await expect(getPlaceGuides(["p1", "p2"])).resolves.toEqual({
    p1: { guide: "Michelin", award: "1 Star", year: 2024 },
  });
  expect(supabase.rpc).toHaveBeenCalledWith("get_place_guides", { place_ids: ["p1", "p2"] });
});

test("getPlaceGuides skips the call and returns empty for no ids", async () => {
  await expect(getPlaceGuides([])).resolves.toEqual({});
  expect(supabase.rpc).not.toHaveBeenCalled();
});

test("getPlaceGuides is best-effort on error", async () => {
  (supabase.rpc as jest.Mock).mockResolvedValue({ data: null, error: new Error("x") });
  await expect(getPlaceGuides(["p1"])).resolves.toEqual({});
});

test("guideBadgeLabel reads as guide and award", () => {
  expect(guideBadgeLabel({ guide: "Good Food", award: "2 Hats", year: 2025 })).toBe("Good Food · 2 Hats");
});

test("annotateGuides attaches a badge only to matched places", () => {
  const places: Place[] = [
    { placeId: "p1", name: "A", lat: 0, lng: 0, cuisines: [] },
    { placeId: "p2", name: "B", lat: 0, lng: 0, cuisines: [] },
  ];
  const out = annotateGuides(places, { p1: { guide: "Michelin", award: "1 Star", year: 2024 } });
  expect(out[0].guideAward).toBe("Michelin · 1 Star");
  expect(out[1].guideAward).toBeUndefined();
});
