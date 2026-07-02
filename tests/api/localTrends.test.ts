import { getWeeklyPlaceTrends } from "../../src/api/localTrends";
import { supabase } from "../../src/lib/supabase";

jest.mock("../../src/lib/supabase", () => ({
  supabase: { rpc: jest.fn() },
}));

beforeEach(() => jest.clearAllMocks());

test("getWeeklyPlaceTrends calls the weekly first-party trend RPC", async () => {
  (supabase.rpc as jest.Mock).mockResolvedValue({
    data: [{
      place_id: "p1",
      trend_score: 19,
      review_count: 1,
      check_in_count: 3,
      save_count: 1,
      loved_count: 1,
      liked_count: 0,
      go_count: 0,
      disliked_count: 0,
    }],
    error: null,
  });

  await expect(getWeeklyPlaceTrends({ weeksBack: 1, limit: 10 })).resolves.toEqual([{
    placeId: "p1",
    trendScore: 19,
    reviewCount: 1,
    checkInCount: 3,
    saveCount: 1,
    lovedCount: 1,
    likedCount: 0,
    goCount: 0,
    dislikedCount: 0,
  }]);

  expect(supabase.rpc).toHaveBeenCalledWith("get_weekly_place_trends", {
    weeks_back: 1,
    max_rows: 10,
  });
});

test("getWeeklyPlaceTrends is best effort on RPC failure", async () => {
  (supabase.rpc as jest.Mock).mockResolvedValue({ data: null, error: new Error("nope") });
  await expect(getWeeklyPlaceTrends()).resolves.toEqual([]);
});
