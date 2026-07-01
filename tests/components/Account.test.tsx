import { render, screen, fireEvent } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import Account from "../../app/(tabs)/account";
import { colors } from "../../src/theme";

jest.mock("expo-router", () => {
  const React = require("react");
  return { router: { push: jest.fn() }, useFocusEffect: (cb: any) => React.useEffect(cb, []) };
});
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("../../src/lib/supabase", () => ({
  supabase: { auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { email: "a@b.com" } } }) } },
}));
jest.mock("../../src/api/social", () => ({
  getMyProfile: jest.fn().mockResolvedValue({ username: "elijahtanblue", sharesActivity: true }),
  getSocialCounts: jest.fn().mockResolvedValue({ followers: 3, following: 5, friends: 2 }),
}));
jest.mock("../../src/api/community", () => ({
  getMyReviews: jest.fn().mockResolvedValue([
    { id: "r1", placeId: "p2", placeName: "CHEF N WOK", body: "Amazing food", rating: 5, placeRating: 4.6, state: "loved", createdAt: "2026-06-30T00:00:00Z" },
    { id: "r2", placeId: "p3", placeName: "Roast Republic", body: "Was good", rating: 2.5, placeRating: 4.1, state: "liked", createdAt: "2026-06-29T00:00:00Z" },
  ]),
}));
jest.mock("../../src/api/myPlaces", () => ({
  getMyPlaces: jest.fn().mockResolvedValue({
    go: [{ placeId: "p1", name: "Gumshara Ramen", state: "go", updatedAt: "2026-06-30T00:00:00Z", placeRating: 4.4, note: null, avoidReason: null }],
    liked: [], loved: [], disliked: [],
  }),
}));
jest.mock("../../src/api/notifications", () => ({ getNotifications: jest.fn().mockResolvedValue([]) }));

test("profile shows the handle and counts and opens settings", async () => {
  const { router } = require("expo-router");
  await render(<Account />);

  expect(await screen.findByText("@elijahtanblue")).toBeTruthy();
  expect(screen.getByText("Followers")).toBeTruthy();

  await fireEvent.press(screen.getByLabelText("Settings"));
  expect(router.push).toHaveBeenCalledWith("/settings");
});

test("opens the TikTok personal capture flow", async () => {
  const { router } = require("expo-router");
  await render(<Account />);

  await fireEvent.press(await screen.findByText("Save from TikTok"));

  expect(router.push).toHaveBeenCalledWith("/tiktok-import");
});

test("toggles from reviews to saved places", async () => {
  await render(<Account />);

  // Reviews view is the default.
  expect(await screen.findByText("Reviews")).toBeTruthy();
  expect(screen.queryByText("Gumshara Ramen")).toBeNull();

  await fireEvent.press(screen.getByText("Saved"));

  expect(await screen.findByText("Gumshara Ramen")).toBeTruthy();
  expect(screen.getByText("★ 4.4")).toBeTruthy();
});

test("review cards show restaurant ratings and sentiment-colored chips", async () => {
  await render(<Account />);

  expect(await screen.findByText("CHEF N WOK")).toBeTruthy();
  expect(screen.getByText("★ 4.6")).toBeTruthy();
  expect(screen.getByText("★ 4.1")).toBeTruthy();
  expect(screen.queryByText("★ 2.5")).toBeNull();

  const lovedStyle = StyleSheet.flatten(screen.getByText("Loved").props.style);
  const likedStyle = StyleSheet.flatten(screen.getByText("Liked").props.style);
  expect(lovedStyle.backgroundColor).toBe(colors.loved);
  expect(likedStyle.backgroundColor).toBe(colors.been);
});
