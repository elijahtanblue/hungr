import { setUserPlaceState } from "../../src/api/userPlaces";
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
