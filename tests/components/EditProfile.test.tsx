import { render, screen, fireEvent } from "@testing-library/react-native";
import EditProfile from "../../app/profile/edit";
import { getMyProfile, setUsername, updateMyProfile } from "../../src/api/social";
import { router } from "expo-router";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("expo-router", () => ({ router: { back: jest.fn(), push: jest.fn() } }));
jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ granted: false }),
  launchImageLibraryAsync: jest.fn(),
}));
jest.mock("../../src/api/avatars", () => ({ uploadAvatar: jest.fn() }));
jest.mock("../../src/api/social", () => ({
  getMyProfile: jest.fn(),
  setUsername: jest.fn(),
  updateMyProfile: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  (getMyProfile as jest.Mock).mockResolvedValue({
    username: "kai", displayName: null, sharesActivity: true, bio: "old bio", avatarUrl: null,
  });
  (setUsername as jest.Mock).mockResolvedValue({ ok: true });
  (updateMyProfile as jest.Mock).mockResolvedValue(true);
});

test("loads the current profile into the fields", async () => {
  await render(<EditProfile />);
  expect(await screen.findByDisplayValue("kai")).toBeTruthy();
  expect(screen.getByDisplayValue("old bio")).toBeTruthy();
});

test("saving an unchanged handle skips setUsername but still writes the bio", async () => {
  await render(<EditProfile />);
  const bio = await screen.findByDisplayValue("old bio");
  await fireEvent.changeText(bio, "new bio");
  await fireEvent.press(screen.getByText("Save"));

  expect(setUsername).not.toHaveBeenCalled();
  expect(updateMyProfile).toHaveBeenCalledWith({ bio: "new bio", avatarUrl: null });
  expect(router.back).toHaveBeenCalled();
});

test("changing the handle claims it and blocks the save when it is taken", async () => {
  (setUsername as jest.Mock).mockResolvedValue({ ok: false, error: "That handle is taken." });
  await render(<EditProfile />);
  const handle = await screen.findByDisplayValue("kai");
  await fireEvent.changeText(handle, "taken_name");
  await fireEvent.press(screen.getByText("Save"));

  expect(setUsername).toHaveBeenCalledWith("taken_name");
  expect(updateMyProfile).not.toHaveBeenCalled();
  expect(await screen.findByText("That handle is taken.")).toBeTruthy();
  expect(router.back).not.toHaveBeenCalled();
});
