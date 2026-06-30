import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import Friends from "../../app/(tabs)/friends";
import { listFollowing, unfriend, unfollowUser } from "../../src/api/social";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 20, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("../../src/api/placeNames", () => ({
  getPlaceNames: jest.fn().mockResolvedValue({}),
}));

jest.mock("../../src/api/social", () => ({
  searchUsers: jest.fn().mockResolvedValue([]),
  listFriends: jest.fn().mockResolvedValue([{ id: "u2", username: "jenny", displayName: "Jenny" }]),
  listFollowing: jest.fn().mockResolvedValue([{ id: "u3", username: "kai", displayName: "Kai" }]),
  pendingFriendRequests: jest.fn().mockResolvedValue([]),
  requestFriend: jest.fn().mockResolvedValue(undefined),
  respondFriend: jest.fn().mockResolvedValue(undefined),
  followUser: jest.fn().mockResolvedValue(undefined),
  unfollowUser: jest.fn().mockResolvedValue(undefined),
  unfriend: jest.fn().mockResolvedValue(undefined),
  friendBeens: jest.fn().mockResolvedValue([]),
  getMyProfile: jest.fn().mockResolvedValue({ username: "elijah", displayName: "Elijah", sharesActivity: true }),
}));

test("Friends lets users remove friends and unfollow one-way follows", async () => {
  await render(<Friends />);

  expect(await screen.findByText("@jenny")).toBeTruthy();
  expect(await screen.findByText("@kai")).toBeTruthy();

  await fireEvent.press(screen.getByText("Remove"));
  await waitFor(() => expect(unfriend).toHaveBeenCalledWith("u2"));

  await fireEvent.press(screen.getByText("Unfollow"));
  await waitFor(() => expect(unfollowUser).toHaveBeenCalledWith("u3"));

  expect(listFollowing).toHaveBeenCalled();
});
