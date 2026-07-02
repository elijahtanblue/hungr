import { getLocalTrendCards } from "../../src/api/localTrends";
import { supabase } from "../../src/lib/supabase";

jest.mock("../../src/lib/supabase", () => ({
  supabase: { rpc: jest.fn() },
}));

beforeEach(() => jest.clearAllMocks());

test("getLocalTrendCards calls the local card RPC with nearby candidate ids", async () => {
  (supabase.rpc as jest.Mock).mockResolvedValue({
    data: [{
      place_id: "p1",
      trend_type: "popping_off",
      headline: "This place is popping off",
      summary: "More hungr activity than usual nearby.",
      trend_score: 23,
      review_count: 4,
      check_in_count: 3,
      save_count: 2,
      loved_count: 1,
      liked_count: 1,
      go_count: 1,
      disliked_count: 0,
      actor_count: 5,
      average_hungr_rating: 4.75,
    }],
    error: null,
  });

  await expect(getLocalTrendCards(["p1", "p2"], { weeksBack: 1, limit: 6, minActorCount: 2 })).resolves.toEqual([{
    placeId: "p1",
    trendType: "popping_off",
    headline: "This place is popping off",
    summary: "More hungr activity than usual nearby.",
    trendScore: 23,
    reviewCount: 4,
    checkInCount: 3,
    saveCount: 2,
    lovedCount: 1,
    likedCount: 1,
    goCount: 1,
    dislikedCount: 0,
    actorCount: 5,
    averageHungrRating: 4.75,
  }]);

  expect(supabase.rpc).toHaveBeenCalledWith("get_local_trend_cards", {
    candidate_place_ids: ["p1", "p2"],
    weeks_back: 1,
    max_rows: 6,
    min_actor_count: 2,
  });
});

test("getLocalTrendCards skips the RPC when there are no local candidates", async () => {
  await expect(getLocalTrendCards([])).resolves.toEqual([]);
  expect(supabase.rpc).not.toHaveBeenCalled();
});

test("getLocalTrendCards is best effort on RPC failure", async () => {
  (supabase.rpc as jest.Mock).mockResolvedValue({ data: null, error: new Error("nope") });
  await expect(getLocalTrendCards(["p1"])).resolves.toEqual([]);
});
