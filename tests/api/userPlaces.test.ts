import { setUserPlaceState, savePlaceFeedback } from "../../src/api/userPlaces";
import { supabase } from "../../src/lib/supabase";

jest.mock("../../src/lib/supabase", () => ({
  supabase: {
    auth: { getUser: jest.fn() },
    from: jest.fn(),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

test("setUserPlaceState returns false when there is no signed in user", async () => {
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: null }, error: null });
  await expect(setUserPlaceState("p1", "go")).resolves.toBe(false);
  expect(supabase.from).not.toHaveBeenCalled();
});

test("setUserPlaceState rejects when anchoring the place fails", async () => {
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
  (supabase.from as jest.Mock).mockReturnValue({
    upsert: jest.fn().mockResolvedValue({ error: new Error("place denied") }),
  });

  await expect(setUserPlaceState("p1", "go")).rejects.toThrow("place denied");
});

test("setUserPlaceState rejects when saving the user state fails", async () => {
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
  (supabase.from as jest.Mock)
    .mockReturnValueOnce({
      upsert: jest.fn().mockResolvedValue({ error: null }),
    })
    .mockReturnValueOnce({
      upsert: jest.fn().mockResolvedValue({ error: new Error("state denied") }),
    });

  await expect(setUserPlaceState("p1", "been")).rejects.toThrow("state denied");
});

test("savePlaceFeedback skips the write when there is nothing to persist", async () => {
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
  await expect(savePlaceFeedback("p1", {})).resolves.toBe(true);
  expect(supabase.from).not.toHaveBeenCalled();
});

test("savePlaceFeedback writes only the provided fields, scoped to the owner's row", async () => {
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
  const eqPlace = jest.fn().mockResolvedValue({ error: null });
  const eqUser = jest.fn().mockReturnValue({ eq: eqPlace });
  const update = jest.fn().mockReturnValue({ eq: eqUser });
  (supabase.from as jest.Mock).mockReturnValue({ update });

  await expect(savePlaceFeedback("p1", { rating: 4, avoidReason: null, note: "great" })).resolves.toBe(true);
  expect(update).toHaveBeenCalledWith({ rating: 4, avoid_reason: null, note: "great" });
  expect(eqUser).toHaveBeenCalledWith("user_id", "u1");
  expect(eqPlace).toHaveBeenCalledWith("place_id", "p1");
});
