import { render, screen } from "@testing-library/react-native";
import MyPlaces from "../../app/my-places";
import { getMyPlaces } from "../../src/api/myPlaces";

jest.mock("expo-router", () => ({ router: { back: jest.fn(), push: jest.fn() } }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 20, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("../../src/api/myPlaces", () => ({
  getMyPlaces: jest.fn(),
}));

test("MyPlaces groups the user's saved food map", async () => {
  (getMyPlaces as jest.Mock).mockResolvedValue({
    go: [{ placeId: "p1", name: "Mr Wong", state: "go", updatedAt: "2026-06-30T02:00:00Z", rating: null, note: null, avoidReason: null }],
    been: [{ placeId: "p2", name: "Gumshara", state: "been", updatedAt: "2026-06-30T01:00:00Z", rating: 5, note: "Great broth", avoidReason: null }],
    avoid: [{ placeId: "p3", name: "Pricey Place", state: "avoid", updatedAt: "2026-06-29T01:00:00Z", rating: null, note: null, avoidReason: "Too expensive" }],
  });

  await render(<MyPlaces />);

  expect(await screen.findByText("Want to go")).toBeTruthy();
  expect(screen.getByText("Mr Wong")).toBeTruthy();
  expect(screen.getByText("Been")).toBeTruthy();
  expect(screen.getByText("Gumshara")).toBeTruthy();
  expect(screen.getByText("★ 5")).toBeTruthy();
  expect(screen.getByText("Great broth")).toBeTruthy();
  expect(screen.getByText("Avoid")).toBeTruthy();
  expect(screen.getByText("Pricey Place")).toBeTruthy();
  expect(screen.getByText("Too expensive")).toBeTruthy();
});
