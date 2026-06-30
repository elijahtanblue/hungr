import { checkIn, getVisitCount, getVisitStatus } from "../../src/api/checkins";
import { supabase } from "../../src/lib/supabase";

jest.mock("../../src/lib/supabase", () => ({
  supabase: { auth: { getUser: jest.fn() }, from: jest.fn(), rpc: jest.fn() },
}));

beforeEach(() => jest.clearAllMocks());

test("getVisitCount returns the row count scoped to the signed-in user and place", async () => {
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: "u1" } } });
  const countEqPlace = jest.fn().mockResolvedValue({ count: 3, error: null });
  const countEqUser = jest.fn().mockReturnValue({ eq: countEqPlace });
  const countSelect = jest.fn().mockReturnValue({ eq: countEqUser });
  const latestLimit = jest.fn().mockResolvedValue({ data: [], error: null });
  const latestOrder = jest.fn().mockReturnValue({ limit: latestLimit });
  const latestEqPlace = jest.fn().mockReturnValue({ order: latestOrder });
  const latestEqUser = jest.fn().mockReturnValue({ eq: latestEqPlace });
  const latestSelect = jest.fn().mockReturnValue({ eq: latestEqUser });
  (supabase.from as jest.Mock)
    .mockReturnValueOnce({ select: countSelect })
    .mockReturnValueOnce({ select: latestSelect });

  await expect(getVisitCount("p1")).resolves.toBe(3);
  expect(countEqUser).toHaveBeenCalledWith("user_id", "u1");
  expect(countEqPlace).toHaveBeenCalledWith("place_id", "p1");
});

test("getVisitCount returns 0 when signed out and never queries", async () => {
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: null } });
  await expect(getVisitCount("p1")).resolves.toBe(0);
  expect(supabase.from).not.toHaveBeenCalled();
});

test("getVisitStatus reports recent check-ins without exposing cooldown copy", async () => {
  jest.spyOn(Date, "now").mockReturnValue(new Date("2026-06-30T02:00:00Z").getTime());
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: "u1" } } });
  const countEqPlace = jest.fn().mockResolvedValue({ count: 3, error: null });
  const countEqUser = jest.fn().mockReturnValue({ eq: countEqPlace });
  const countSelect = jest.fn().mockReturnValue({ eq: countEqUser });
  const latestLimit = jest.fn().mockResolvedValue({
    data: [{ created_at: "2026-06-30T01:15:00Z" }],
    error: null,
  });
  const latestOrder = jest.fn().mockReturnValue({ limit: latestLimit });
  const latestEqPlace = jest.fn().mockReturnValue({ order: latestOrder });
  const latestEqUser = jest.fn().mockReturnValue({ eq: latestEqPlace });
  const latestSelect = jest.fn().mockReturnValue({ eq: latestEqUser });
  (supabase.from as jest.Mock)
    .mockReturnValueOnce({ select: countSelect })
    .mockReturnValueOnce({ select: latestSelect });

  await expect(getVisitStatus("p1")).resolves.toEqual({ count: 3, checkedInRecently: true });
  jest.restoreAllMocks();
});

test("checkIn uses the throttled RPC and returns the visit status", async () => {
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
  (supabase.rpc as jest.Mock).mockResolvedValue({
    data: [{ visit_count: 3, checked_in: false, checked_in_recently: true }],
    error: null,
  });

  await expect(checkIn("p1")).resolves.toEqual({ count: 3, checkedIn: false, checkedInRecently: true });
  expect(supabase.rpc).toHaveBeenCalledWith("check_in_place", { target_place_id: "p1" });
});

test("checkIn returns null when signed out", async () => {
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: null }, error: null });
  await expect(checkIn("p1")).resolves.toBeNull();
});
