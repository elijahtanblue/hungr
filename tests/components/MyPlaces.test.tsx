import { render, screen, fireEvent } from "@testing-library/react-native";
import MyPlaces from "../../app/my-places";
import { getMyPlaces } from "../../src/api/myPlaces";

jest.mock("expo-router", () => ({ router: { back: jest.fn(), push: jest.fn() } }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 20, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("../../src/api/myPlaces", () => ({
  getMyPlaces: jest.fn(),
}));

const groups = {
  go: [{ placeId: "p1", name: "Mr Wong", state: "go", updatedAt: "2026-06-30T02:00:00Z", rating: null, note: null, avoidReason: null }],
  liked: [{ placeId: "p2", name: "Gumshara", state: "liked", updatedAt: "2026-06-30T01:00:00Z", rating: 5, note: "Great broth", avoidReason: null }],
  loved: [],
  disliked: [{ placeId: "p3", name: "Pricey Place", state: "disliked", updatedAt: "2026-06-29T01:00:00Z", rating: null, note: null, avoidReason: "Too expensive" }],
};

test("MyPlaces shows the Want to go tab first and switches groups on tab press", async () => {
  (getMyPlaces as jest.Mock).mockResolvedValue(groups);

  await render(<MyPlaces />);

  // Default tab is Want to go.
  expect(await screen.findByText("Mr Wong")).toBeTruthy();
  expect(screen.queryByText("Gumshara")).toBeNull();

  // Switch to Liked.
  await fireEvent.press(screen.getByText("Liked"));
  expect(screen.getByText("Gumshara")).toBeTruthy();
  expect(screen.getByText("★ 5.0")).toBeTruthy();
  expect(screen.getByText("Great broth")).toBeTruthy();

  // Switch to Disliked.
  await fireEvent.press(screen.getByText("Disliked"));
  expect(screen.getByText("Pricey Place")).toBeTruthy();
  expect(screen.getByText("Too expensive")).toBeTruthy();
});
