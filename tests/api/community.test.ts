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
  },
}));

beforeEach(() => jest.clearAllMocks());

test("getCommunity rejects when any community query fails", async () => {
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: "u1" } } });
  (supabase.from as jest.Mock)
    .mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({ data: null, error: new Error("reviews blocked") }),
        }),
      }),
    })
    .mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ data: [], error: null }),
      }),
    });

  await expect(getCommunity("p1")).rejects.toThrow("reviews blocked");
});

test("getCommunity marks the signed-in user's own reviews", async () => {
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: "u1" } } });
  (supabase.from as jest.Mock)
    .mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({
            data: [
              { id: "r1", user_id: "u1", body: "My noodles note", rating: 5, created_at: "2026-06-30T00:00:00Z" },
              { id: "r2", user_id: "u2", body: "Someone else's note", rating: 4, created_at: "2026-06-29T00:00:00Z" },
            ],
            error: null,
          }),
        }),
      }),
    })
    .mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ data: [{ tag: "Hidden gem" }], error: null }),
      }),
    });

  await expect(getCommunity("p1")).resolves.toEqual({
    reviews: [
      { id: "r1", userId: "u1", isMine: true, body: "My noodles note", rating: 5, createdAt: "2026-06-30T00:00:00Z" },
      { id: "r2", userId: "u2", isMine: false, body: "Someone else's note", rating: 4, createdAt: "2026-06-29T00:00:00Z" },
    ],
    tags: ["Hidden gem"],
  });
});

test("saveCommunityReview inserts a new first-party review after anchoring the place", async () => {
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
  const placeUpsert = jest.fn().mockResolvedValue({ error: null });
  const reviewInsert = jest.fn().mockResolvedValue({ error: null });
  (supabase.from as jest.Mock)
    .mockReturnValueOnce({ upsert: placeUpsert })
    .mockReturnValueOnce({ insert: reviewInsert });

  await expect(saveCommunityReview("p1", { body: "Best char kway teow nearby", rating: 5 })).resolves.toBe(true);
  expect(placeUpsert).toHaveBeenCalledWith({ place_id: "p1" }, { onConflict: "place_id", ignoreDuplicates: true });
  expect(reviewInsert).toHaveBeenCalledWith({ user_id: "u1", place_id: "p1", body: "Best char kway teow nearby", rating: 5 });
});

test("saveCommunityReview updates only the caller's own review when an id is present", async () => {
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
  const eqUser = jest.fn().mockResolvedValue({ error: null });
  const eqId = jest.fn().mockReturnValue({ eq: eqUser });
  const update = jest.fn().mockReturnValue({ eq: eqId });
  (supabase.from as jest.Mock).mockReturnValue({ update });

  await expect(saveCommunityReview("p1", { id: "r1", body: "Still great", rating: 4 })).resolves.toBe(true);
  expect(update).toHaveBeenCalledWith({ body: "Still great", rating: 4 });
  expect(eqId).toHaveBeenCalledWith("id", "r1");
  expect(eqUser).toHaveBeenCalledWith("user_id", "u1");
});

test("saveCommunityReview ignores blank review text", async () => {
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
  await expect(saveCommunityReview("p1", { body: "   ", rating: 5 })).resolves.toBe(false);
  expect(supabase.from).not.toHaveBeenCalled();
});

test("deleteCommunityReview deletes only the caller's own review row", async () => {
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
  const eqUser = jest.fn().mockResolvedValue({ error: null });
  const eqId = jest.fn().mockReturnValue({ eq: eqUser });
  const del = jest.fn().mockReturnValue({ eq: eqId });
  (supabase.from as jest.Mock).mockReturnValue({ delete: del });

  await expect(deleteCommunityReview("r1")).resolves.toBe(true);
  expect(eqId).toHaveBeenCalledWith("id", "r1");
  expect(eqUser).toHaveBeenCalledWith("user_id", "u1");
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
