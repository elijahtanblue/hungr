import { fireEvent, render, screen } from "@testing-library/react-native";
import PlaceDetail from "../../app/place/[placeId]";
import { getCommunity } from "../../src/api/community";
import { getPlaceDetails } from "../../src/api/placeDetails";

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ placeId: "p1" }),
  router: { back: jest.fn(), push: jest.fn() },
}));
jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ granted: false }),
  launchImageLibraryAsync: jest.fn(),
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 20, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("../../src/api/placeDetails", () => ({
  getPlaceDetails: jest.fn(),
}));
jest.mock("../../src/api/grounding", () => ({
  getGrounded: jest.fn().mockResolvedValue(null),
}));
jest.mock("../../src/api/placePhotos", () => ({
  getPhotoUri: jest.fn().mockResolvedValue(null),
}));
jest.mock("../../src/api/community", () => ({
  getCommunity: jest.fn(),
  getCommunityPage: jest.fn().mockResolvedValue({ reviews: [], hasMore: false, nextOffset: 0 }),
  saveCommunityReview: jest.fn().mockResolvedValue("r1"),
  deleteCommunityReview: jest.fn().mockResolvedValue(true),
  addPlaceTag: jest.fn().mockResolvedValue(true),
  upvoteReview: jest.fn().mockResolvedValue(undefined),
  reportReview: jest.fn().mockResolvedValue(undefined),
  reportReviewPhoto: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../../src/api/reviewPhotos", () => ({
  moderateAndAttachReviewPhoto: jest.fn().mockResolvedValue({ approved: true }),
}));
jest.mock("../../src/api/googleReviewTranslation", () => ({
  translateGoogleReview: jest.fn().mockResolvedValue(null),
}));
jest.mock("../../src/api/guides", () => ({
  getPlaceGuides: jest.fn().mockResolvedValue({}),
  guideBadgeLabel: (g: any) => `${g.guide} · ${g.award}`,
}));

test("PlaceDetail shows compact separate hungr and Google ratings with review tabs", async () => {
  (getPlaceDetails as jest.Mock).mockResolvedValue({
    placeId: "p1",
    name: "Mel's Drive-In",
    rating: 3.7,
    userRatingCount: 5509,
    address: "801 Mission St",
    reviews: [{ author: "Jane", rating: 4, text: "Classic diner.", relativeTime: "2 months ago" }],
    attribution: "Powered by Google",
  });
  (getCommunity as jest.Mock).mockResolvedValue({
    ratingAverage: 4.5,
    ratingCount: 12,
    tags: [],
    reviews: [
      {
        id: "r1",
        userId: "u1",
        isMine: true,
        authorUsername: null,
        authorName: null,
        body: "Great fries.",
        rating: 4.5,
        upvotes: 0,
        mineUpvoted: false,
        createdAt: "2026-06-30T00:00:00Z",
        photos: [],
      },
    ],
    hasMore: false,
  });

  await render(<PlaceDetail />);

  expect(await screen.findByText("Mel's Drive-In")).toBeTruthy();
  // Ratings now appear once, in the header row (the duplicate pills above the tabs were removed).
  expect(screen.getByText("★ hungr 4.5 (12)")).toBeTruthy();
  expect(screen.getByText("★ 3.7 (5509)")).toBeTruthy();
  expect(screen.getByText("Great fries.")).toBeTruthy();
  expect(screen.queryByText("Jane")).toBeNull();

  await fireEvent.press(screen.getByText("Google reviews"));

  expect(await screen.findByText("Jane")).toBeTruthy();
  expect(screen.getByText("Powered by Google")).toBeTruthy();
});
