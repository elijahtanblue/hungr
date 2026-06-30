import { render, screen, fireEvent } from "@testing-library/react-native";
import Account from "../../app/(tabs)/account";

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
jest.mock("../../src/api/community", () => ({ getMyReviews: jest.fn().mockResolvedValue([]) }));
jest.mock("../../src/api/myPlaces", () => ({
  getMyPlaces: jest.fn().mockResolvedValue({
    go: [{ placeId: "p1", name: "Gumshara Ramen", state: "go", updatedAt: "2026-06-30T00:00:00Z", rating: null, note: null, avoidReason: null }],
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
});
