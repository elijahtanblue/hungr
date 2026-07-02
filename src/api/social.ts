import { supabase } from "../lib/supabase";

// The V2 social layer. All mutations and cross-user reads go through SECURITY DEFINER RPCs
// (see migration 0005_social.sql), so visibility rules live in one audited place and a follower
// can only ever learn that someone has BEEN to a place, never their avoid or want-to-go.

export type UserSummary = { id: string; username: string | null; displayName: string | null };
export type MyProfile = {
  username: string | null;
  displayName: string | null;
  sharesActivity: boolean;
  bio: string | null;
  avatarUrl: string | null;
};

// Your own profile. Read directly (own-row RLS allows it) rather than via an RPC.
export async function getMyProfile(): Promise<MyProfile | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("username, display_name, shares_activity, bio, avatar_url")
    .eq("id", u.user.id)
    .single();
  if (error || !data) return null;
  return {
    username: data.username ?? null,
    displayName: data.display_name ?? null,
    sharesActivity: data.shares_activity ?? true,
    bio: data.bio ?? null,
    avatarUrl: data.avatar_url ?? null,
  };
}

// Save editable profile fields (bio and/or avatar). Only provided fields are written. Own-row RLS.
export async function updateMyProfile(fields: { bio?: string | null; avatarUrl?: string | null }): Promise<boolean> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return false;
  const patch: Record<string, unknown> = {};
  if (fields.bio !== undefined) patch.bio = fields.bio?.trim() ? fields.bio.trim().slice(0, 300) : null;
  if (fields.avatarUrl !== undefined) patch.avatar_url = fields.avatarUrl;
  if (Object.keys(patch).length === 0) return true;
  const { error } = await supabase.from("profiles").update(patch).eq("id", u.user.id);
  return !error;
}

// Toggle whether followers can see where you have been. friend_beens enforces this server side.
export async function setShareActivity(value: boolean): Promise<boolean> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return false;
  const { error } = await supabase.from("profiles").update({ shares_activity: value }).eq("id", u.user.id);
  return !error;
}

// Claim a discovery handle. Lowercased so it matches the case-insensitive unique index.
export async function setUsername(username: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const handle = username.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(handle)) {
    return { ok: false, error: "Use 3-20 letters, numbers, or underscores." };
  }
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { ok: false, error: "Not signed in." };
  const { error } = await supabase.from("profiles").update({ username: handle }).eq("id", u.user.id);
  if (error) {
    if ((error as { code?: string }).code === "23505") return { ok: false, error: "That handle is taken." };
    return { ok: false, error: "Could not save your handle." };
  }
  return { ok: true };
}
export type FriendBeen = {
  placeId: string;
  friendId: string;
  friendName: string | null;
  friendUsername: string | null;
  visitedAt: string;
};

function toUserSummary(row: any): UserSummary {
  return { id: row.id, username: row.username ?? null, displayName: row.display_name ?? null };
}

export async function followUser(target: string): Promise<void> {
  const { error } = await supabase.rpc("follow_user", { target });
  if (error) throw error;
}

// Ensure the signed-in user follows the founder account. Idempotent and fail-soft; called on
// launch so initial users see the founder's activity from day one.
export async function ensureFollowingFounder(): Promise<void> {
  await supabase.rpc("ensure_following_founder");
}

export type SocialCounts = { followers: number; following: number; friends: number };

// Follower / following / friend counts for the profile header.
export async function getSocialCounts(): Promise<SocialCounts> {
  const { data, error } = await supabase.rpc("get_social_counts");
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row) return { followers: 0, following: 0, friends: 0 };
  return {
    followers: Number(row.followers ?? 0),
    following: Number(row.following ?? 0),
    friends: Number(row.friends ?? 0),
  };
}

export async function unfollowUser(target: string): Promise<void> {
  const { error } = await supabase.rpc("unfollow_user", { target });
  if (error) throw error;
}

export async function requestFriend(target: string): Promise<void> {
  const { error } = await supabase.rpc("request_friend", { target });
  if (error) throw error;
}

export async function respondFriend(requester: string, accept: boolean): Promise<void> {
  const { error } = await supabase.rpc("respond_friend", { requester, accept });
  if (error) throw error;
}

export async function unfriend(other: string): Promise<void> {
  const { error } = await supabase.rpc("unfriend", { other });
  if (error) throw error;
}

export async function searchUsers(q: string): Promise<UserSummary[]> {
  const query = q.trim();
  if (!query) return [];
  const { data, error } = await supabase.rpc("search_users", { q: query });
  if (error || !Array.isArray(data)) return [];
  return data.map(toUserSummary);
}

export async function listFriends(): Promise<UserSummary[]> {
  const { data, error } = await supabase.rpc("list_friends");
  if (error || !Array.isArray(data)) return [];
  return data.map(toUserSummary);
}

export async function listFollowing(): Promise<UserSummary[]> {
  const { data, error } = await supabase.rpc("list_following");
  if (error || !Array.isArray(data)) return [];
  return data.map(toUserSummary);
}

export async function pendingFriendRequests(): Promise<UserSummary[]> {
  const { data, error } = await supabase.rpc("pending_friend_requests");
  if (error || !Array.isArray(data)) return [];
  return data.map(toUserSummary);
}

// BEEN places of everyone the caller follows (friends included). Used by the friends feed and
// the "Friends Been" map layer.
export async function friendBeens(): Promise<FriendBeen[]> {
  const { data, error } = await supabase.rpc("friend_beens");
  if (error || !Array.isArray(data)) return [];
  return data.map((row: any) => ({
    placeId: row.place_id,
    friendId: row.friend_id,
    friendName: row.friend_name ?? null,
    friendUsername: row.friend_username ?? null,
    visitedAt: row.visited_at,
  }));
}
