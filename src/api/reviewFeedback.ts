import { saveCommunityReview } from "./community";
import { savePlaceFeedback } from "./userPlaces";

export type ReviewFeedbackState = "liked" | "loved" | "disliked";
export type ReviewFeedbackResult = { rating: number | null; reason: string | null; note: string };

export async function saveReviewFeedback(
  placeId: string,
  state: ReviewFeedbackState,
  result: ReviewFeedbackResult,
): Promise<void> {
  const note = result.note.trim();
  await savePlaceFeedback(placeId, {
    rating: result.rating,
    avoidReason: state === "disliked" ? result.reason : null,
    note: note || null,
  });
  if (note) {
    await saveCommunityReview(placeId, { body: note, rating: result.rating });
  }
}
