import { render, screen, fireEvent } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import Feed from "../../app/(tabs)/feed";
import { getFollowingFeed } from "../../src/api/feed";
import { getWeeklyPlaceTrends, getLocalTrendCards } from "../../src/api/localTrends";
import { getPlaceNames } from "../../src/api/placeNames";
import { recordTrendFollowTaste } from "../../src/api/tasteTracking";
import { router } from "expo-router";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("../../src/api/feed", () => ({ getFollowingFeed: jest.fn() }));
jest.mock("../../src/api/localTrends", () => ({ getWeeklyPlaceTrends: jest.fn(), getLocalTrendCards: jest.fn() }));
jest.mock("../../src/api/placeNames", () => ({ getPlaceNames: jest.fn() }));
jest.mock("../../src/api/tasteTracking", () => ({ recordTrendFollowTaste: jest.fn(() => Promise.resolve(true)) }));

beforeEach(() => {
  jest.clearAllMocks();
  (getFollowingFeed as jest.Mock).mockResolvedValue([
    { reviewId: "r1", placeId: "p1", authorId: "u1", authorUsername: "kai", authorName: null, body: "Great laksa", rating: 4, createdAt: new Date().toISOString(), photoCount: 2 },
  ]);
  (getWeeklyPlaceTrends as jest.Mock).mockResolvedValue([
    { placeId: "p2", trendScore: 9, reviewCount: 3, checkInCount: 8, saveCount: 5, lovedCount: 0, likedCount: 0, goCount: 0, dislikedCount: 0 },
  ]);
  (getLocalTrendCards as jest.Mock).mockResolvedValue([
    { placeId: "p2", trendType: "popping_off", headline: "This place is popping off", summary: "More people nearby are saving, visiting, or reviewing it this week.", trendScore: 9, reviewCount: 3, checkInCount: 8, saveCount: 5, lovedCount: 0, likedCount: 0, goCount: 0, dislikedCount: 0, actorCount: 4 },
  ]);
  (getPlaceNames as jest.Mock).mockResolvedValue({ p1: "Noodle House", p2: "Wine Bar" });
});

test("Feed respects the phone safe area at the top", async () => {
  await render(<Feed />);
  const screenRoot = screen.getByTestId("feed-screen");
  expect(StyleSheet.flatten(screenRoot.props.style).paddingTop).toBeGreaterThan(47);
});

test("Feed keeps a local trends rail and never a global one", async () => {
  await render(<Feed />);
  expect(screen.getAllByText("Feed").length).toBeGreaterThanOrEqual(1);
  expect(screen.getByText("Local trends")).toBeTruthy();
  expect(screen.queryByText("Global")).toBeNull();
});

test("the feed rail shows people posting reviews and photos", async () => {
  await render(<Feed />);
  expect(await screen.findByText("Noodle House")).toBeTruthy();
  expect(screen.getByText("@kai")).toBeTruthy();
  expect(screen.getByText("Great laksa")).toBeTruthy();
  expect(screen.getByText("★ 4 · 2 photos · just now")).toBeTruthy();
});

test("the local trends rail shows anonymized editorial trend cards", async () => {
  await render(<Feed />);
  await screen.findByText("Noodle House"); // wait for load
  await fireEvent.press(screen.getByText("Local trends"));
  expect(await screen.findByText("This place is popping off")).toBeTruthy();
  expect(screen.getByText("Wine Bar")).toBeTruthy();
  expect(screen.getByText("More people nearby are saving, visiting, or reviewing it this week.")).toBeTruthy();
});

test("opening a trend card records a follow-trend taste signal", async () => {
  await render(<Feed />);
  await screen.findByText("Noodle House"); // wait for load
  await fireEvent.press(screen.getByText("Local trends"));
  await fireEvent.press(await screen.findByText("This place is popping off"));
  expect(recordTrendFollowTaste).toHaveBeenCalledWith("p2");
  expect(router.push).toHaveBeenCalledWith({ pathname: "/place/[placeId]", params: { placeId: "p2" } });
});

test("tapping a feed item opens the place detail", async () => {
  await render(<Feed />);
  await fireEvent.press(await screen.findByLabelText("Open Noodle House"));
  expect(router.push).toHaveBeenCalledWith({ pathname: "/place/[placeId]", params: { placeId: "p1" } });
});
