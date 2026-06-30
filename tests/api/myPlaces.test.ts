import { getMyPlaces } from "../../src/api/myPlaces";
import { getPlaceNames } from "../../src/api/placeNames";
import { supabase } from "../../src/lib/supabase";

jest.mock("../../src/api/placeNames", () => ({
  getPlaceNames: jest.fn(),
}));

jest.mock("../../src/lib/supabase", () => ({
  supabase: {
    auth: { getUser: jest.fn() },
    from: jest.fn(),
  },
}));

beforeEach(() => jest.clearAllMocks());

test("getMyPlaces returns grouped saved places with live names", async () => {
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
  const order = jest.fn().mockResolvedValue({
    data: [
      { place_id: "p1", state: "go", updated_at: "2026-06-30T02:00:00Z", rating: null, note: null, avoid_reason: null },
      { place_id: "p2", state: "been", updated_at: "2026-06-30T01:00:00Z", rating: 5, note: "Great", avoid_reason: null },
      { place_id: "p3", state: "avoid", updated_at: "2026-06-29T01:00:00Z", rating: null, note: null, avoid_reason: "Too expensive" },
    ],
    error: null,
  });
  const eq = jest.fn().mockReturnValue({ order });
  const select = jest.fn().mockReturnValue({ eq });
  (supabase.from as jest.Mock).mockReturnValue({ select });
  (getPlaceNames as jest.Mock).mockResolvedValue({ p1: "Mr Wong", p2: "Gumshara", p3: "Pricey Place" });

  await expect(getMyPlaces()).resolves.toEqual({
    go: [{ placeId: "p1", name: "Mr Wong", state: "go", updatedAt: "2026-06-30T02:00:00Z", rating: null, note: null, avoidReason: null }],
    been: [{ placeId: "p2", name: "Gumshara", state: "been", updatedAt: "2026-06-30T01:00:00Z", rating: 5, note: "Great", avoidReason: null }],
    avoid: [{ placeId: "p3", name: "Pricey Place", state: "avoid", updatedAt: "2026-06-29T01:00:00Z", rating: null, note: null, avoidReason: "Too expensive" }],
  });
  expect(eq).toHaveBeenCalledWith("user_id", "u1");
  expect(order).toHaveBeenCalledWith("updated_at", { ascending: false });
});

test("getMyPlaces returns empty groups when signed out", async () => {
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: null }, error: null });

  await expect(getMyPlaces()).resolves.toEqual({ go: [], been: [], avoid: [] });
  expect(supabase.from).not.toHaveBeenCalled();
});
