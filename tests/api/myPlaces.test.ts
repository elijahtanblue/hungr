import { getMyPlaces } from "../../src/api/myPlaces";
import { getPlacePins } from "../../src/api/placePins";
import { supabase } from "../../src/lib/supabase";

jest.mock("../../src/api/placePins", () => ({
  getPlacePins: jest.fn(),
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
      { place_id: "p2", state: "liked", updated_at: "2026-06-30T01:00:00Z", rating: 5, note: "Great", avoid_reason: null },
      { place_id: "p3", state: "disliked", updated_at: "2026-06-29T01:00:00Z", rating: null, note: null, avoid_reason: "Too expensive" },
    ],
    error: null,
  });
  const eq = jest.fn().mockReturnValue({ order });
  const select = jest.fn().mockReturnValue({ eq });
  (supabase.from as jest.Mock).mockReturnValue({ select });
  (getPlacePins as jest.Mock).mockResolvedValue({
    p1: { name: "Mr Wong", rating: 4.6 },
    p2: { name: "Gumshara", rating: 4.2 },
    p3: { name: "Pricey Place", rating: 3.8 },
  });

  await expect(getMyPlaces()).resolves.toEqual({
    go: [{ placeId: "p1", name: "Mr Wong", state: "go", updatedAt: "2026-06-30T02:00:00Z", placeRating: 4.6, note: null, avoidReason: null }],
    liked: [{ placeId: "p2", name: "Gumshara", state: "liked", updatedAt: "2026-06-30T01:00:00Z", placeRating: 4.2, note: "Great", avoidReason: null }],
    loved: [],
    disliked: [{ placeId: "p3", name: "Pricey Place", state: "disliked", updatedAt: "2026-06-29T01:00:00Z", placeRating: 3.8, note: null, avoidReason: "Too expensive" }],
  });
  expect(select).toHaveBeenCalledWith("place_id, state, updated_at, note, avoid_reason");
  expect(eq).toHaveBeenCalledWith("user_id", "u1");
  expect(order).toHaveBeenCalledWith("updated_at", { ascending: false });
});

test("getMyPlaces returns empty groups when signed out", async () => {
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: null }, error: null });

  await expect(getMyPlaces()).resolves.toEqual({ go: [], liked: [], loved: [], disliked: [] });
  expect(supabase.from).not.toHaveBeenCalled();
});
