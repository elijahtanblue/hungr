import { fireEvent, render, screen } from "@testing-library/react-native";
import PlaceDetail from "../../app/place/[placeId]";
import { getCommunity } from "../../src/api/community";
import { getPlaceDetails } from "../../src/api/placeDetails";

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ placeId: "p1" }),
  router: { back: jest.fn() },
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
jest.mock("../../src/api/community", () => ({
  getCommunity: jest.fn(),
  saveCommunityReview: jest.fn().mockResolvedValue(true),
  deleteCommunityReview: jest.fn().mockResolvedValue(true),
  addPlaceTag: jest.fn().mockResolvedValue(true),
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
      { id: "r1", userId: "u1", isMine: true, body: "Great fries.", rating: 4.5, createdAt: "2026-06-30T00:00:00Z" },
    ],
  });

  await render(<PlaceDetail />);

  expect(await screen.findByText("Mel's Drive-In")).toBeTruthy();
  expect(screen.getByText("hungr ★ 4.5 (12)")).toBeTruthy();
  expect(screen.getByText("Google ★ 3.7 (5509)")).toBeTruthy();
  expect(screen.getByText("Great fries.")).toBeTruthy();
  expect(screen.queryByText("Jane")).toBeNull();

  await fireEvent.press(screen.getByText("Google reviews"));

  expect(await screen.findByText("Jane")).toBeTruthy();
  expect(screen.getByText("Powered by Google")).toBeTruthy();
});
