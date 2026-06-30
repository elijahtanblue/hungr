import {
  addPlaceTag,
  deleteCommunityReview,
  getCommunity,
  saveCommunityReview,
} from "../../src/api/community";
import { supabase } from "../../src/lib/supabase";

jest.mock("../../src/lib/supabase", () => ({
  supabase: {
    auth: { getUser: jest.fn() },
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

beforeEach(() => jest.clearAllMocks());

test("getCommunity rejects when any community query fails", async () => {
  (supabase.rpc as jest.Mock)
    .mockResolvedValueOnce({ data: null, error: new Error("reviews blocked") })
    .mockResolvedValueOnce({ data: [], error: null });

  await expect(getCommunity("p1")).rejects.toThrow("reviews blocked");
});

test("getCommunity reads through safe RPCs and marks the user's own reviews", async () => {
  (supabase.rpc as jest.Mock)
    .mockResolvedValueOnce({
      data: [
        { id: "r1", body: "My noodles note", rating: 5, created_at: "2026-06-30T00:00:00Z", is_mine: true },
        { id: "r2", body: "Someone else's note", rating: 4, created_at: "2026-06-29T00:00:00Z", is_mine: false },
      ],
      error: null,
    })
    .mockResolvedValueOnce({ data: [{ tag: "Hidden gem" }], error: null });

  await expect(getCommunity("p1")).resolves.toEqual({
    reviews: [
      { id: "r1", userId: null, isMine: true, body: "My noodles note", rating: 5, createdAt: "2026-06-30T00:00:00Z" },
      { id: "r2", userId: null, isMine: false, body: "Someone else's note", rating: 4, createdAt: "2026-06-29T00:00:00Z" },
    ],
    ratingAverage: 4.5,
    ratingCount: 2,
    tags: ["Hidden gem"],
  });
  expect(supabase.rpc).toHaveBeenCalledWith("get_place_reviews", { target_place_id: "p1" });
  expect(supabase.rpc).toHaveBeenCalledWith("get_place_tags", { target_place_id: "p1" });
});

test("saveCommunityReview inserts a new first-party review through ownership RPC", async () => {
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
  (supabase.rpc as jest.Mock).mockResolvedValue({ data: true, error: null });

  await expect(saveCommunityReview("p1", { body: "Best char kway teow nearby", rating: 4.5 })).resolves.toBe(true);
  expect(supabase.rpc).toHaveBeenCalledWith("save_place_review", {
    target_place_id: "p1",
    review_id: null,
    review_body: "Best char kway teow nearby",
    review_rating: 4.5,
  });
});

test("saveCommunityReview updates only through the ownership RPC when an id is present", async () => {
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
  (supabase.rpc as jest.Mock).mockResolvedValue({ data: true, error: null });

  await expect(saveCommunityReview("p1", { id: "r1", body: "Still great", rating: 4 })).resolves.toBe(true);
  expect(supabase.rpc).toHaveBeenCalledWith("save_place_review", {
    target_place_id: "p1",
    review_id: "r1",
    review_body: "Still great",
    review_rating: 4,
  });
});

test("saveCommunityReview ignores blank review text", async () => {
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
  await expect(saveCommunityReview("p1", { body: "   ", rating: 5 })).resolves.toBe(false);
  expect(supabase.from).not.toHaveBeenCalled();
});

test("deleteCommunityReview deletes only the caller's own review row", async () => {
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
  (supabase.rpc as jest.Mock).mockResolvedValue({ data: true, error: null });

  await expect(deleteCommunityReview("r1")).resolves.toBe(true);
  expect(supabase.rpc).toHaveBeenCalledWith("delete_place_review", { review_id: "r1" });
});

test("addPlaceTag trims long tags and writes them as first-party UGC", async () => {
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
  const placeUpsert = jest.fn().mockResolvedValue({ error: null });
  const tagInsert = jest.fn().mockResolvedValue({ error: null });
  (supabase.from as jest.Mock)
    .mockReturnValueOnce({ upsert: placeUpsert })
    .mockReturnValueOnce({ insert: tagInsert });

  await expect(addPlaceTag("p1", "  late night noodles with a very very very long label  ")).resolves.toBe(true);
  expect(tagInsert).toHaveBeenCalledWith({
    place_id: "p1",
    tag: "late night noodles with a very very very",
    created_by: "u1",
  });
});
