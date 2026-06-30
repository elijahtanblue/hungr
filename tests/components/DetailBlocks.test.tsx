import { render, screen } from "@testing-library/react-native";
import { GoogleReviewsBlock } from "../../src/components/GoogleReviewsBlock";
import { GroundedBlock } from "../../src/components/GroundedBlock";
import { CommunityBlock } from "../../src/components/CommunityBlock";
import type { PlaceDetails } from "../../src/api/placeDetails";

test("GoogleReviewsBlock shows a review and always renders attribution", async () => {
  const details: PlaceDetails = {
    placeId: "p1",
    name: "Spicy World",
    rating: 4.6,
    reviews: [
      { author: "Jane", rating: 5, text: "The mala numbs.", relativeTime: "2 weeks ago" },
      { author: "Kai", rating: 4, text: "Great noodles.", relativeTime: "1 month ago" },
    ],
    attribution: "Powered by Google",
  };
  await render(<GoogleReviewsBlock details={details} />);
  expect(screen.getByText("Jane")).toBeTruthy();
  expect(screen.getByText("The mala numbs.")).toBeTruthy();
  expect(screen.getByText("Powered by Google")).toBeTruthy(); // attribution must render
  expect(screen.getAllByTestId("google-review-card")).toHaveLength(2);
});

test("GroundedBlock shows the answer and its source link", async () => {
  await render(<GroundedBlock grounded={{ text: "Known for mapo tofu.", sources: ["https://maps.google.com/?cid=1"] }} />);
  expect(screen.getByText("Known for mapo tofu.")).toBeTruthy();
  expect(screen.getByText("https://maps.google.com/?cid=1")).toBeTruthy();
});

test("GroundedBlock renders nothing without sources, so AI content is never unattributed", async () => {
  await render(<GroundedBlock grounded={{ text: "Known for mapo tofu.", sources: [] }} />);
  expect(screen.queryByText("Known for mapo tofu.")).toBeNull();
});

test("CommunityBlock shows a warm empty state when there is nothing yet", async () => {
  await render(<CommunityBlock reviews={[]} tags={[]} />);
  expect(screen.getByText("No community reviews yet. Be the first to add one.")).toBeTruthy();
});
