import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import TikTokImport from "../../app/tiktok-import";
import { resolveTikTokLink, saveTikTokCandidate } from "../../src/api/tiktokImport";

jest.mock("expo-router", () => ({
  router: { back: jest.fn(), replace: jest.fn() },
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("expo-location", () => ({
  getForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: "denied" }),
  getCurrentPositionAsync: jest.fn(),
}));
jest.mock("../../src/api/tiktokImport", () => ({
  resolveTikTokLink: jest.fn(),
  saveTikTokCandidate: jest.fn(),
}));

const source = {
  url: "https://www.tiktok.com/@creator/video/123",
  videoId: "123",
  creator: "Creator",
  creatorUrl: "https://www.tiktok.com/@creator",
  title: "Best steak night at The Gidley",
};

const candidate = {
  placeId: "place-1",
  name: "The Gidley",
  address: "161 King St, Sydney",
  lat: -33.87,
  lng: 151.21,
  rating: 4,
  cuisines: ["Steakhouse"],
  confidence: 0.99,
  recommended: true,
  evidence: "TikTok caption mentions The Gidley.",
};

beforeEach(() => jest.clearAllMocks());

test("TikTok import requires user confirmation before saving", async () => {
  (resolveTikTokLink as jest.Mock).mockResolvedValue({ source, dishTags: ["steak"], candidates: [candidate] });
  (saveTikTokCandidate as jest.Mock).mockResolvedValue(true);

  await render(<TikTokImport />);

  await fireEvent.changeText(screen.getByPlaceholderText("Paste TikTok link"), source.url);
  await fireEvent.press(screen.getByText("Find the place"));

  expect(await screen.findByText("The Gidley")).toBeTruthy();
  expect(screen.getByText("Recommended match")).toBeTruthy();
  expect(screen.getByText("Steakhouse  ·  ★ 4.0")).toBeTruthy();
  expect(saveTikTokCandidate).not.toHaveBeenCalled();

  await fireEvent.press(screen.getByText("Save this place"));

  await waitFor(() => expect(saveTikTokCandidate).toHaveBeenCalledWith(source, candidate, ["steak"]));
  expect(await screen.findByText("Saved to Want to go")).toBeTruthy();
});

test("TikTok import shows a manual fallback when no confident candidates return", async () => {
  (resolveTikTokLink as jest.Mock).mockResolvedValue({ source, dishTags: [], candidates: [] });

  await render(<TikTokImport />);

  await fireEvent.changeText(screen.getByPlaceholderText("Paste TikTok link"), source.url);
  await fireEvent.press(screen.getByText("Find the place"));

  expect(await screen.findByText("We could not confidently find the place.")).toBeTruthy();
  expect(saveTikTokCandidate).not.toHaveBeenCalled();
});
