import { saveReviewFeedback } from "../../src/api/reviewFeedback";
import { saveCommunityReview } from "../../src/api/community";
import { savePlaceFeedback } from "../../src/api/userPlaces";

jest.mock("../../src/api/community", () => ({
  saveCommunityReview: jest.fn().mockResolvedValue(true),
}));
jest.mock("../../src/api/userPlaces", () => ({
  savePlaceFeedback: jest.fn().mockResolvedValue(true),
}));

beforeEach(() => jest.clearAllMocks());

test("saveReviewFeedback writes Liked ratings privately and posts non-empty notes as hungr reviews", async () => {
  await saveReviewFeedback("p1", "liked", { rating: 4.5, reason: null, note: "Great noodles." });

  expect(savePlaceFeedback).toHaveBeenCalledWith("p1", {
    rating: 4.5,
    avoidReason: null,
    note: "Great noodles.",
  });
  expect(saveCommunityReview).toHaveBeenCalledWith("p1", { body: "Great noodles.", rating: 4.5 });
});

test("saveReviewFeedback can turn Disliked notes into hungr reviews while preserving the private reason chip", async () => {
  await saveReviewFeedback("p2", "disliked", { rating: 2.5, reason: "Too expensive", note: "Overpriced for the quality." });

  expect(savePlaceFeedback).toHaveBeenCalledWith("p2", {
    rating: 2.5,
    avoidReason: "Too expensive",
    note: "Overpriced for the quality.",
  });
  expect(saveCommunityReview).toHaveBeenCalledWith("p2", { body: "Overpriced for the quality.", rating: 2.5 });
});

test("saveReviewFeedback skips public review creation when the short review is blank", async () => {
  await saveReviewFeedback("p3", "liked", { rating: 5, reason: null, note: "   " });

  expect(saveCommunityReview).not.toHaveBeenCalled();
});
