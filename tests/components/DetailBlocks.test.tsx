import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
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

test("CommunityBlock lets a signed-in user write a hungr review", async () => {
  const onSaveReview = jest.fn().mockResolvedValue(undefined);

  await render(<CommunityBlock reviews={[]} tags={[]} onSaveReview={onSaveReview} />);

  await fireEvent.changeText(screen.getByPlaceholderText("What should future you remember?"), "Get the chilli oil noodles.");
  await fireEvent.press(screen.getByText("5"));
  await fireEvent.press(screen.getByText("Post review"));

  await waitFor(() =>
    expect(onSaveReview).toHaveBeenCalledWith({ body: "Get the chilli oil noodles.", rating: 5 }),
  );
});

test("CommunityBlock lets a user edit and delete only their own review", async () => {
  const onSaveReview = jest.fn().mockResolvedValue(undefined);
  const onDeleteReview = jest.fn().mockResolvedValue(undefined);

  await render(
    <CommunityBlock
      tags={[]}
      reviews={[
        { id: "r1", userId: "u1", isMine: true, body: "Original", rating: 4, createdAt: "2026-06-30T00:00:00Z" },
        { id: "r2", userId: "u2", isMine: false, body: "Not mine", rating: 5, createdAt: "2026-06-30T00:00:00Z" },
      ]}
      onSaveReview={onSaveReview}
      onDeleteReview={onDeleteReview}
    />,
  );

  expect(screen.getAllByText("Edit")).toHaveLength(1);
  expect(screen.getAllByText("Delete")).toHaveLength(1);

  await fireEvent.press(screen.getByText("Edit"));
  await fireEvent.changeText(screen.getByDisplayValue("Original"), "Updated");
  await fireEvent.press(screen.getByText("Save review"));

  await waitFor(() =>
    expect(onSaveReview).toHaveBeenCalledWith({ id: "r1", body: "Updated", rating: 4 }),
  );

  await fireEvent.press(screen.getByText("Delete"));
  expect(onDeleteReview).toHaveBeenCalledWith("r1");
});

test("CommunityBlock lets a user add a simple community tag", async () => {
  const onAddTag = jest.fn().mockResolvedValue(undefined);

  await render(<CommunityBlock reviews={[]} tags={["Hidden gem"]} onAddTag={onAddTag} />);

  await fireEvent.changeText(screen.getByPlaceholderText("Add a tag"), "new management");
  await fireEvent.press(screen.getByText("Add tag"));

  await waitFor(() => expect(onAddTag).toHaveBeenCalledWith("new management"));
});

test("CommunityBlock keeps the draft visible when a review save fails", async () => {
  const onSaveReview = jest.fn().mockRejectedValue(new Error("network down"));

  await render(<CommunityBlock reviews={[]} tags={[]} onSaveReview={onSaveReview} />);

  await fireEvent.changeText(screen.getByPlaceholderText("What should future you remember?"), "Do not lose this.");
  await fireEvent.press(screen.getByText("Post review"));

  expect(await screen.findByText("Could not save review. Try again.")).toBeTruthy();
  expect(screen.getByDisplayValue("Do not lose this.")).toBeTruthy();
});
