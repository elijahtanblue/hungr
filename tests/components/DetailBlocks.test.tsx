import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { GoogleReviewsBlock } from "../../src/components/GoogleReviewsBlock";
import { GroundedBlock } from "../../src/components/GroundedBlock";
import { CommunityBlock } from "../../src/components/CommunityBlock";
import type { PlaceDetails } from "../../src/api/placeDetails";
import { translateGoogleReview } from "../../src/api/googleReviewTranslation";

jest.mock("../../src/api/googleReviewTranslation", () => ({
  translateGoogleReview: jest.fn(),
}));

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
  expect(screen.getByText("★ 5.0")).toBeTruthy();
  expect(screen.getByText("★ 4.0")).toBeTruthy();
  expect(screen.queryByText("Translate")).toBeNull();
});

test("GoogleReviewsBlock toggles an individual Google review translation", async () => {
  (translateGoogleReview as jest.Mock).mockResolvedValue("The noodles were excellent.");
  const details: PlaceDetails = {
    placeId: "p1",
    name: "Spicy World",
    reviews: [{ author: "Jane", rating: 5, text: "Los fideos estuvieron excelentes.", relativeTime: "2 weeks ago" }],
    attribution: "Powered by Google",
  };

  await render(<GoogleReviewsBlock details={details} />);
  await fireEvent.press(screen.getByText("Translate"));

  expect(await screen.findByText("The noodles were excellent.")).toBeTruthy();
  await fireEvent.press(screen.getByText("Original"));
  expect(screen.getByText("Los fideos estuvieron excelentes.")).toBeTruthy();
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
  await fireEvent.press(screen.getByLabelText("4.5 stars"));
  await fireEvent.press(screen.getByText("Post review"));

  await waitFor(() =>
    expect(onSaveReview).toHaveBeenCalledWith({ body: "Get the chilli oil noodles.", rating: 4.5 }),
  );
});

test("CommunityBlock attaches selected photos after the review is saved", async () => {
  const onSaveReview = jest.fn().mockResolvedValue("r-new");
  const onPickPhotos = jest.fn().mockResolvedValue([{ uri: "file:///tmp/food.jpg", fileName: "food.jpg" }]);
  const onAttachPhotos = jest.fn().mockResolvedValue(undefined);

  await render(
    <CommunityBlock
      reviews={[]}
      tags={[]}
      onSaveReview={onSaveReview}
      onPickPhotos={onPickPhotos}
      onAttachPhotos={onAttachPhotos}
    />,
  );

  await fireEvent.press(screen.getByText("Add photo"));
  expect(await screen.findByText("1 photo selected")).toBeTruthy();
  await fireEvent.changeText(screen.getByPlaceholderText("What should future you remember?"), "Good laksa.");
  await fireEvent.press(screen.getByLabelText("5 stars"));
  await fireEvent.press(screen.getByText("Post review"));

  await waitFor(() => expect(onAttachPhotos).toHaveBeenCalledWith("r-new", [{ uri: "file:///tmp/food.jpg", fileName: "food.jpg" }]));
});

test("CommunityBlock previews selected photos before posting", async () => {
  const onPickPhotos = jest.fn().mockResolvedValue([
    { uri: "file:///tmp/taco.jpg", fileName: "taco.jpg" },
    { uri: "file:///tmp/noodles.jpg", fileName: "noodles.jpg" },
  ]);

  await render(
    <CommunityBlock
      reviews={[]}
      tags={[]}
      onSaveReview={jest.fn()}
      onPickPhotos={onPickPhotos}
    />,
  );

  await fireEvent.press(screen.getByText("Add photo"));

  expect(await screen.findByText("2 photos selected")).toBeTruthy();
  expect(screen.getAllByTestId("selected-review-photo")).toHaveLength(2);
  expect(screen.getByLabelText("Selected photo 1")).toBeTruthy();
  expect(screen.getByLabelText("Selected photo 2")).toBeTruthy();
});

test("CommunityBlock rejects unsupported selected photo formats before posting", async () => {
  const onPickPhotos = jest.fn().mockResolvedValue([
    { uri: "file:///tmp/IMG_0001.HEIC", fileName: "IMG_0001.HEIC", mimeType: "image/heic" },
  ]);

  await render(
    <CommunityBlock
      reviews={[]}
      tags={[]}
      onSaveReview={jest.fn()}
      onPickPhotos={onPickPhotos}
    />,
  );

  await fireEvent.press(screen.getByText("Add photo"));

  expect(await screen.findByText("Choose a JPG, PNG, or WebP photo.")).toBeTruthy();
  expect(screen.queryByText("1 photo selected")).toBeNull();
  expect(screen.queryAllByTestId("selected-review-photo")).toHaveLength(0);
});

test("CommunityBlock does not show save failure or keep draft after only photo attach fails", async () => {
  const onSaveReview = jest.fn().mockResolvedValue("r-new");
  const onPickPhotos = jest.fn().mockResolvedValue([{ uri: "file:///tmp/food.jpg", fileName: "food.jpg" }]);
  const onAttachPhotos = jest.fn().mockRejectedValue(new Error("storage duplicate"));

  await render(
    <CommunityBlock
      reviews={[]}
      tags={[]}
      onSaveReview={onSaveReview}
      onPickPhotos={onPickPhotos}
      onAttachPhotos={onAttachPhotos}
    />,
  );

  await fireEvent.press(screen.getByText("Add photo"));
  await fireEvent.changeText(screen.getByPlaceholderText("What should future you remember?"), "Good laksa.");
  await fireEvent.press(screen.getByLabelText("5 stars"));
  await fireEvent.press(screen.getByText("Post review"));

  expect(await screen.findByText("Review posted, but the photos could not be attached.")).toBeTruthy();
  expect(screen.queryByText("Could not save review. Try again.")).toBeNull();
  expect(screen.queryByDisplayValue("Good laksa.")).toBeNull();
});

test("CommunityBlock shows the specific photo attach failure reason when available", async () => {
  const onSaveReview = jest.fn().mockResolvedValue("r-new");
  const onPickPhotos = jest.fn().mockResolvedValue([{ uri: "file:///tmp/food.jpg", fileName: "food.jpg", mimeType: "image/jpeg" }]);
  const onAttachPhotos = jest.fn().mockRejectedValue(new Error("Vision SafeSearch failed. Check GOOGLE_VISION_KEY."));

  await render(
    <CommunityBlock
      reviews={[]}
      tags={[]}
      onSaveReview={onSaveReview}
      onPickPhotos={onPickPhotos}
      onAttachPhotos={onAttachPhotos}
    />,
  );

  await fireEvent.press(screen.getByText("Add photo"));
  await fireEvent.changeText(screen.getByPlaceholderText("What should future you remember?"), "Good laksa.");
  await fireEvent.press(screen.getByLabelText("5 stars"));
  await fireEvent.press(screen.getByText("Post review"));

  expect(await screen.findByText("Vision SafeSearch failed. Check GOOGLE_VISION_KEY.")).toBeTruthy();
  expect(screen.queryByText("Could not save review. Try again.")).toBeNull();
});

test("CommunityBlock exposes search, sort, filters, and load more controls for hungr reviews", async () => {
  const onFiltersChange = jest.fn();
  const onLoadMore = jest.fn();

  await render(
    <CommunityBlock
      reviews={[]}
      tags={[]}
      filters={{ search: "", sort: "newest", photosOnly: false }}
      onFiltersChange={onFiltersChange}
      hasMore
      onLoadMore={onLoadMore}
    />,
  );

  await fireEvent.changeText(screen.getByPlaceholderText("Search hungr reviews"), "ramen");
  await fireEvent.press(screen.getByText("Popular"));
  await fireEvent.press(screen.getByText("With photos"));
  await fireEvent.press(screen.getByText("Load more"));

  expect(onFiltersChange).toHaveBeenCalledWith(expect.objectContaining({ search: "ramen" }));
  expect(onFiltersChange).toHaveBeenCalledWith(expect.objectContaining({ sort: "popular" }));
  expect(onFiltersChange).toHaveBeenCalledWith(expect.objectContaining({ photosOnly: true }));
  expect(onLoadMore).toHaveBeenCalled();
});

test("CommunityBlock lets a user edit and delete only their own review", async () => {
  const onSaveReview = jest.fn().mockResolvedValue(undefined);
  const onDeleteReview = jest.fn().mockResolvedValue(undefined);

  await render(
    <CommunityBlock
      tags={[]}
      reviews={[
        {
          id: "r1", userId: "u1", isMine: true, authorUsername: null, authorName: null,
          body: "Original", rating: 4, upvotes: 0, mineUpvoted: false, createdAt: "2026-06-30T00:00:00Z", photos: [],
        },
        {
          id: "r2", userId: "u2", isMine: false, authorUsername: "kai", authorName: null,
          body: "Not mine", rating: 5, upvotes: 0, mineUpvoted: false, createdAt: "2026-06-30T00:00:00Z", photos: [],
        },
      ]}
      onSaveReview={onSaveReview}
      onDeleteReview={onDeleteReview}
    />,
  );

  expect(screen.getAllByText("Edit")).toHaveLength(1);
  expect(screen.getAllByText("Delete")).toHaveLength(1);
  expect(screen.getAllByText("Jun 30, 2026")).toHaveLength(2);
  expect(screen.getByText("★ 4.0")).toBeTruthy();
  expect(screen.getByText("★ 5.0")).toBeTruthy();

  await fireEvent.press(screen.getByText("Edit"));
  await fireEvent.changeText(screen.getByDisplayValue("Original"), "Updated");
  await fireEvent.press(screen.getByText("Save review"));

  await waitFor(() =>
    expect(onSaveReview).toHaveBeenCalledWith({ id: "r1", body: "Updated", rating: 4 }),
  );

  await fireEvent.press(screen.getByText("Delete"));
  expect(onDeleteReview).toHaveBeenCalledWith("r1");
});

test("CommunityBlock shows optional sentiment and place tags without requiring them", async () => {
  await render(
    <CommunityBlock
      tags={["Great food", "Late night"]}
      reviews={[
        {
          id: "r1", userId: "u1", isMine: false, authorUsername: "jenny", authorName: null,
          body: "Would return.", rating: 5, state: "loved", upvotes: 0, mineUpvoted: false, createdAt: "2026-06-30T00:00:00Z", photos: [],
        },
        {
          id: "r2", userId: "u2", isMine: false, authorUsername: null, authorName: null,
          body: "No sentiment yet.", rating: undefined, upvotes: 0, mineUpvoted: false, createdAt: "2026-06-30T00:00:00Z", photos: [],
        },
      ]}
    />,
  );

  expect(screen.getByText("Loved")).toBeTruthy();
  expect(screen.getByText("Great food")).toBeTruthy();
  expect(screen.getByText("Late night")).toBeTruthy();
  expect(screen.getByText("No sentiment yet.")).toBeTruthy();
});

test("CommunityBlock lets a user add a simple community tag", async () => {
  const onAddTag = jest.fn().mockResolvedValue(undefined);

  await render(<CommunityBlock reviews={[]} tags={["Hidden gem"]} onAddTag={onAddTag} />);

  await fireEvent.changeText(screen.getByPlaceholderText("Add a tag"), "new management");
  await fireEvent.press(screen.getByText("Add tag"));

  await waitFor(() => expect(onAddTag).toHaveBeenCalledWith("new management"));
});

test("CommunityBlock will not post a review without a rating", async () => {
  const onSaveReview = jest.fn().mockResolvedValue("r-new");

  await render(<CommunityBlock reviews={[]} tags={[]} onSaveReview={onSaveReview} />);

  await fireEvent.changeText(screen.getByPlaceholderText("What should future you remember?"), "No stars yet.");
  // The hint appears and pressing Post does nothing until a rating is chosen.
  expect(screen.getByText("Add a star rating to post your review.")).toBeTruthy();
  await fireEvent.press(screen.getByText("Post review"));
  expect(onSaveReview).not.toHaveBeenCalled();

  await fireEvent.press(screen.getByLabelText("4 stars"));
  await fireEvent.press(screen.getByText("Post review"));
  await waitFor(() => expect(onSaveReview).toHaveBeenCalledWith({ id: undefined, body: "No stars yet.", rating: 4 }));
});

test("CommunityBlock keeps the draft visible when a review save fails", async () => {
  const onSaveReview = jest.fn().mockRejectedValue(new Error("network down"));

  await render(<CommunityBlock reviews={[]} tags={[]} onSaveReview={onSaveReview} />);

  await fireEvent.changeText(screen.getByPlaceholderText("What should future you remember?"), "Do not lose this.");
  await fireEvent.press(screen.getByLabelText("5 stars"));
  await fireEvent.press(screen.getByText("Post review"));

  expect(await screen.findByText("Could not save review. Try again.")).toBeTruthy();
  expect(screen.getByDisplayValue("Do not lose this.")).toBeTruthy();
});
