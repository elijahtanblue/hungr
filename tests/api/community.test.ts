import {
  addPlaceTag,
  deleteCommunityReview,
  getCommunity,
  saveCommunityReview,
  upvoteReview,
  reportReview,
  reportReviewPhoto,
  getCommunityPage,
  getUserProfile,
  getUserReviews,
} from "../../src/api/community";
import { supabase } from "../../src/lib/supabase";

jest.mock("../../src/lib/supabase", () => ({
  supabase: {
    auth: { getUser: jest.fn() },
    from: jest.fn(),
    rpc: jest.fn(),
    storage: { from: jest.fn() },
  },
}));
jest.mock("../../src/api/placeNames", () => ({
  getPlaceNames: jest.fn().mockResolvedValue({ p1: "Mr Wong" }),
}));

beforeEach(() => jest.clearAllMocks());

test("getCommunity rejects when any community query fails", async () => {
  (supabase.rpc as jest.Mock)
    .mockResolvedValueOnce({ data: null, error: new Error("reviews blocked") })
    .mockResolvedValueOnce({ data: [], error: null });

  await expect(getCommunity("p1")).rejects.toThrow("reviews blocked");
});

test("getCommunity reads through safe RPCs and marks the user's own reviews", async () => {
  const signedUrl = jest.fn().mockResolvedValue({ data: { signedUrl: "https://signed/review.jpg" }, error: null });
  (supabase.storage.from as jest.Mock).mockReturnValue({ createSignedUrl: signedUrl });
  (supabase.rpc as jest.Mock)
    .mockResolvedValueOnce({
      data: [
        {
          id: "r1",
          body: "My noodles note",
          rating: 5,
          state: "loved",
          created_at: "2026-06-30T00:00:00Z",
          is_mine: true,
          author_id: "u1",
          author_username: "me",
          author_name: "Me",
          upvotes: 2,
          mine_upvoted: true,
          photos: [{ id: "ph1", storage_path: "u1/r1/a.jpg", width: 800, height: 600, created_at: "2026-06-30T00:01:00Z" }],
        },
        { id: "r2", body: "Someone else's note", rating: 4, state: null, created_at: "2026-06-29T00:00:00Z", is_mine: false, author_id: "u2", author_username: "jenny", author_name: "Jenny", upvotes: 0, mine_upvoted: false },
      ],
      error: null,
    })
    .mockResolvedValueOnce({ data: [{ tag: "Hidden gem" }], error: null });

  await expect(getCommunity("p1")).resolves.toEqual({
    reviews: [
      {
        id: "r1",
        userId: "u1",
        isMine: true,
        authorUsername: "me",
        authorName: "Me",
        body: "My noodles note",
        rating: 5,
        state: "loved",
        upvotes: 2,
        mineUpvoted: true,
        createdAt: "2026-06-30T00:00:00Z",
        photos: [{ id: "ph1", reviewId: "r1", storagePath: "u1/r1/a.jpg", uri: "https://signed/review.jpg", width: 800, height: 600, createdAt: "2026-06-30T00:01:00Z" }],
      },
      { id: "r2", userId: "u2", isMine: false, authorUsername: "jenny", authorName: "Jenny", body: "Someone else's note", rating: 4, upvotes: 0, mineUpvoted: false, createdAt: "2026-06-29T00:00:00Z", photos: [] },
    ],
    ratingAverage: 4.5,
    ratingCount: 2,
    tags: ["Hidden gem"],
    hasMore: false,
    nextOffset: 2,
  });
  expect(supabase.rpc).toHaveBeenCalledWith("get_place_reviews_page", {
    target_place_id: "p1",
    page_limit: 26,
    page_offset: 0,
    search_query: null,
    sort_by: "newest",
    state_filter: null,
    min_rating: null,
    photos_only: false,
  });
  expect(supabase.rpc).toHaveBeenCalledWith("get_place_tags", { target_place_id: "p1" });
});

test("getCommunityPage sends search, sort, and filter options and exposes hasMore", async () => {
  (supabase.storage.from as jest.Mock).mockReturnValue({ createSignedUrl: jest.fn() });
  (supabase.rpc as jest.Mock).mockResolvedValue({
    data: [
      { id: "r1", body: "Wagyu was great", rating: 5, created_at: "2026-06-30T00:00:00Z", upvotes: 8 },
      { id: "r2", body: "Solid", rating: 4, created_at: "2026-06-29T00:00:00Z", upvotes: 2 },
    ],
    error: null,
  });

  await expect(getCommunityPage("p1", {
    limit: 1,
    offset: 10,
    search: "wagyu",
    sort: "popular",
    state: "loved",
    minRating: 4.5,
    photosOnly: true,
  })).resolves.toMatchObject({
    hasMore: true,
    nextOffset: 11,
    reviews: [{ id: "r1", body: "Wagyu was great", photos: [] }],
  });

  expect(supabase.rpc).toHaveBeenCalledWith("get_place_reviews_page", {
    target_place_id: "p1",
    page_limit: 2,
    page_offset: 10,
    search_query: "wagyu",
    sort_by: "popular",
    state_filter: "loved",
    min_rating: 4.5,
    photos_only: true,
  });
});

test("upvoteReview toggles via the right RPC", async () => {
  (supabase.rpc as jest.Mock).mockResolvedValue({ error: null });
  await upvoteReview("r1", true);
  expect(supabase.rpc).toHaveBeenCalledWith("upvote_review", { target_review_id: "r1" });
  await upvoteReview("r1", false);
  expect(supabase.rpc).toHaveBeenCalledWith("remove_review_upvote", { target_review_id: "r1" });
});

test("reportReview flags a review for moderation", async () => {
  (supabase.rpc as jest.Mock).mockResolvedValue({ error: null });
  await reportReview("r2");
  expect(supabase.rpc).toHaveBeenCalledWith("report_review", { target_review_id: "r2", reason: null });
});

test("reportReviewPhoto flags a review photo for moderation", async () => {
  (supabase.rpc as jest.Mock).mockResolvedValue({ error: null });
  await reportReviewPhoto("ph1", "Not food");
  expect(supabase.rpc).toHaveBeenCalledWith("report_review_photo", { target_photo_id: "ph1", reason: "Not food" });
});

test("getUserProfile maps the RPC row and follow state", async () => {
  (supabase.rpc as jest.Mock).mockResolvedValue({
    data: [{ id: "u2", username: "jenny", display_name: "Jenny", followers: 4, following: 9, is_following: true }],
    error: null,
  });
  await expect(getUserProfile("u2")).resolves.toEqual({
    id: "u2", username: "jenny", displayName: "Jenny", followers: 4, following: 9, isFollowing: true,
  });
});

test("getUserReviews resolves place names", async () => {
  (supabase.rpc as jest.Mock).mockResolvedValue({
    data: [{ id: "rv1", place_id: "p1", body: "Loved it", rating: 5, created_at: "2026-06-30T00:00:00Z", upvotes: 3 }],
    error: null,
  });
  await expect(getUserReviews("u2")).resolves.toEqual([
    { id: "rv1", placeId: "p1", placeName: "Mr Wong", body: "Loved it", rating: 5, upvotes: 3, createdAt: "2026-06-30T00:00:00Z" },
  ]);
});

test("saveCommunityReview returns the saved review id from the ownership RPC", async () => {
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
  (supabase.rpc as jest.Mock).mockResolvedValue({ data: "r-new", error: null });

  await expect(saveCommunityReview("p1", { body: "Best char kway teow nearby", rating: 4.5 })).resolves.toBe("r-new");
  expect(supabase.rpc).toHaveBeenCalledWith("save_place_review_v2", {
    target_place_id: "p1",
    review_id: null,
    review_body: "Best char kway teow nearby",
    review_rating: 4.5,
  });
});

test("saveCommunityReview updates only through the ownership RPC when an id is present", async () => {
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
  (supabase.rpc as jest.Mock).mockResolvedValue({ data: "r1", error: null });

  await expect(saveCommunityReview("p1", { id: "r1", body: "Still great", rating: 4 })).resolves.toBe("r1");
  expect(supabase.rpc).toHaveBeenCalledWith("save_place_review_v2", {
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
