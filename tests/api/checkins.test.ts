import { checkIn, getVisitCount } from "../../src/api/checkins";
import { supabase } from "../../src/lib/supabase";

jest.mock("../../src/lib/supabase", () => ({
  supabase: { auth: { getUser: jest.fn() }, from: jest.fn() },
}));

beforeEach(() => jest.clearAllMocks());

test("getVisitCount returns the row count scoped to the signed-in user and place", async () => {
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: "u1" } } });
  const eqPlace = jest.fn().mockResolvedValue({ count: 3, error: null });
  const eqUser = jest.fn().mockReturnValue({ eq: eqPlace });
  const select = jest.fn().mockReturnValue({ eq: eqUser });
  (supabase.from as jest.Mock).mockReturnValue({ select });

  await expect(getVisitCount("p1")).resolves.toBe(3);
  expect(eqUser).toHaveBeenCalledWith("user_id", "u1");
  expect(eqPlace).toHaveBeenCalledWith("place_id", "p1");
});

test("getVisitCount returns 0 when signed out and never queries", async () => {
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: null } });
  await expect(getVisitCount("p1")).resolves.toBe(0);
  expect(supabase.from).not.toHaveBeenCalled();
});

test("checkIn anchors the place, records a visit, and returns the new count", async () => {
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
  const upsert = jest.fn().mockResolvedValue({ error: null });
  const insert = jest.fn().mockResolvedValue({ error: null });
  const eqPlace = jest.fn().mockResolvedValue({ count: 1, error: null });
  const eqUser = jest.fn().mockReturnValue({ eq: eqPlace });
  const select = jest.fn().mockReturnValue({ eq: eqUser });
  (supabase.from as jest.Mock).mockImplementation((table: string) =>
    table === "places" ? { upsert } : { insert, select },
  );

  await expect(checkIn("p1")).resolves.toBe(1);
  expect(insert).toHaveBeenCalledWith({ user_id: "u1", place_id: "p1" });
});

test("checkIn returns null when signed out", async () => {
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: null }, error: null });
  await expect(checkIn("p1")).resolves.toBeNull();
});
