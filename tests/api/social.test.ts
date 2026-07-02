import {
  followUser, requestFriend, respondFriend, searchUsers, listFriends, listFollowing, friendBeens,
  getMyProfile, setUsername, setShareActivity, unfollowUser, unfriend, getSocialCounts, updateMyProfile,
} from "../../src/api/social";
import { supabase } from "../../src/lib/supabase";

jest.mock("../../src/lib/supabase", () => ({
  supabase: { rpc: jest.fn(), auth: { getUser: jest.fn() }, from: jest.fn() },
}));

beforeEach(() => jest.clearAllMocks());

test("followUser calls the follow_user RPC with the target", async () => {
  (supabase.rpc as jest.Mock).mockResolvedValue({ error: null });
  await followUser("u2");
  expect(supabase.rpc).toHaveBeenCalledWith("follow_user", { target: "u2" });
});

test("unfollowUser and unfriend call their RPCs with the target", async () => {
  (supabase.rpc as jest.Mock).mockResolvedValue({ error: null });

  await unfollowUser("u2");
  await unfriend("u3");

  expect(supabase.rpc).toHaveBeenCalledWith("unfollow_user", { target: "u2" });
  expect(supabase.rpc).toHaveBeenCalledWith("unfriend", { other: "u3" });
});

test("mutations surface RPC errors", async () => {
  (supabase.rpc as jest.Mock).mockResolvedValue({ error: new Error("denied") });
  await expect(requestFriend("u2")).rejects.toThrow("denied");
});

test("respondFriend passes the accept flag", async () => {
  (supabase.rpc as jest.Mock).mockResolvedValue({ error: null });
  await respondFriend("u2", true);
  expect(supabase.rpc).toHaveBeenCalledWith("respond_friend", { requester: "u2", accept: true });
});

test("getSocialCounts reads the counts RPC and coerces to numbers", async () => {
  (supabase.rpc as jest.Mock).mockResolvedValue({ data: [{ followers: 3, following: 5, friends: 2 }], error: null });
  await expect(getSocialCounts()).resolves.toEqual({ followers: 3, following: 5, friends: 2 });
  expect(supabase.rpc).toHaveBeenCalledWith("get_social_counts");
});

test("getSocialCounts fails soft to zeros", async () => {
  (supabase.rpc as jest.Mock).mockResolvedValue({ data: null, error: new Error("down") });
  await expect(getSocialCounts()).resolves.toEqual({ followers: 0, following: 0, friends: 0 });
});

test("getMyProfile reads bio and avatar alongside the handle", async () => {
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: "u1" } } });
  const single = jest.fn().mockResolvedValue({
    data: { username: "kai", display_name: "Kai", shares_activity: true, bio: "loves noodles", avatar_url: "https://x/y.jpg" },
    error: null,
  });
  (supabase.from as jest.Mock).mockReturnValue({ select: () => ({ eq: () => ({ single }) }) });

  await expect(getMyProfile()).resolves.toEqual({
    username: "kai", displayName: "Kai", sharesActivity: true, bio: "loves noodles", avatarUrl: "https://x/y.jpg",
  });
});

test("updateMyProfile writes only the provided fields, trimmed", async () => {
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: "u1" } } });
  const eq = jest.fn().mockResolvedValue({ error: null });
  const update = jest.fn().mockReturnValue({ eq });
  (supabase.from as jest.Mock).mockReturnValue({ update });

  await expect(updateMyProfile({ bio: "  hi there  " })).resolves.toBe(true);
  expect(update).toHaveBeenCalledWith({ bio: "hi there" });
  expect(eq).toHaveBeenCalledWith("id", "u1");
});

test("updateMyProfile clears the bio when given an empty string", async () => {
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: "u1" } } });
  const eq = jest.fn().mockResolvedValue({ error: null });
  const update = jest.fn().mockReturnValue({ eq });
  (supabase.from as jest.Mock).mockReturnValue({ update });

  await updateMyProfile({ bio: "   " });
  expect(update).toHaveBeenCalledWith({ bio: null });
});

test("setShareActivity updates the caller's own profile flag", async () => {
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: "u1" } } });
  const eq = jest.fn().mockResolvedValue({ error: null });
  const update = jest.fn().mockReturnValue({ eq });
  (supabase.from as jest.Mock).mockReturnValue({ update });

  await expect(setShareActivity(false)).resolves.toBe(true);
  expect(update).toHaveBeenCalledWith({ shares_activity: false });
  expect(eq).toHaveBeenCalledWith("id", "u1");
});

test("searchUsers maps rows and skips the RPC for blank input", async () => {
  expect(await searchUsers("   ")).toEqual([]);
  expect(supabase.rpc).not.toHaveBeenCalled();

  (supabase.rpc as jest.Mock).mockResolvedValue({
    data: [{ id: "u2", username: "jenny", display_name: "Jenny" }],
    error: null,
  });
  expect(await searchUsers("jen")).toEqual([{ id: "u2", username: "jenny", displayName: "Jenny" }]);
});

test("read helpers fail soft to an empty list on error", async () => {
  (supabase.rpc as jest.Mock).mockResolvedValue({ data: null, error: new Error("rpc down") });
  expect(await listFriends()).toEqual([]);
});

test("listFollowing maps one-way follows", async () => {
  (supabase.rpc as jest.Mock).mockResolvedValue({
    data: [{ id: "u2", username: "jenny", display_name: "Jenny" }],
    error: null,
  });

  await expect(listFollowing()).resolves.toEqual([{ id: "u2", username: "jenny", displayName: "Jenny" }]);
  expect(supabase.rpc).toHaveBeenCalledWith("list_following");
});

test("friendBeens maps snake_case rows to camelCase", async () => {
  (supabase.rpc as jest.Mock).mockResolvedValue({
    data: [{ place_id: "p1", friend_id: "u2", friend_name: "Jenny", friend_username: "jenny", visited_at: "2026-06-30T00:00:00Z" }],
    error: null,
  });
  expect(await friendBeens()).toEqual([
    { placeId: "p1", friendId: "u2", friendName: "Jenny", friendUsername: "jenny", visitedAt: "2026-06-30T00:00:00Z" },
  ]);
});

test("setUsername rejects malformed handles before any network call", async () => {
  const res = await setUsername("ab");
  expect(res).toEqual({ ok: false, error: expect.stringContaining("3-20") });
  expect(supabase.from).not.toHaveBeenCalled();
});

test("setUsername surfaces a taken handle", async () => {
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: "u1" } } });
  (supabase.from as jest.Mock).mockReturnValue({
    update: () => ({ eq: jest.fn().mockResolvedValue({ error: { code: "23505" } }) }),
  });
  expect(await setUsername("Jenny")).toEqual({ ok: false, error: "That handle is taken." });
});

test("setUsername lowercases and saves a valid handle", async () => {
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: "u1" } } });
  const eq = jest.fn().mockResolvedValue({ error: null });
  const update = jest.fn().mockReturnValue({ eq });
  (supabase.from as jest.Mock).mockReturnValue({ update });
  expect(await setUsername("Jenny")).toEqual({ ok: true });
  expect(update).toHaveBeenCalledWith({ username: "jenny" });
});

test("getMyProfile returns null when signed out", async () => {
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: null } });
  expect(await getMyProfile()).toBeNull();
});
