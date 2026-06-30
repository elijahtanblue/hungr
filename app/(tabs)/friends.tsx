import { useCallback, useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, Share, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  searchUsers, listFriends, pendingFriendRequests, requestFriend, respondFriend, followUser,
  unfollowUser, unfriend, listFollowing, friendBeens, getMyProfile, type UserSummary, type FriendBeen,
} from "../../src/api/social";
import { getPlaceNames } from "../../src/api/placeNames";
import { useDebouncedValue } from "../../src/hooks/useDebouncedValue";
import { colors, radius, space } from "../../src/theme";

function label(u: UserSummary): string {
  return u.username ? `@${u.username}` : u.displayName ?? "Someone";
}

function feedLabel(b: FriendBeen): string {
  return b.friendUsername ? `@${b.friendUsername}` : b.friendName ?? "A friend";
}

function ago(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const day = Math.floor(ms / 86400000);
  if (day >= 1) return `${day}d ago`;
  const hr = Math.floor(ms / 3600000);
  if (hr >= 1) return `${hr}h ago`;
  const min = Math.floor(ms / 60000);
  return min >= 1 ? `${min}m ago` : "just now";
}

export default function Friends() {
  const insets = useSafeAreaInsets();
  const [friends, setFriends] = useState<UserSummary[]>([]);
  const [requests, setRequests] = useState<UserSummary[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSummary[]>([]);
  const [requested, setRequested] = useState<Set<string>>(new Set());
  const [following, setFollowing] = useState<UserSummary[]>([]);
  const [feed, setFeed] = useState<FriendBeen[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [myHandle, setMyHandle] = useState<string | null>(null);
  const [feedTab, setFeedTab] = useState<"friends" | "following">("friends");

  const load = useCallback(() => {
    listFriends().then(setFriends).catch(() => {});
    listFollowing().then(setFollowing).catch(() => {});
    pendingFriendRequests().then(setRequests).catch(() => {});
    getMyProfile().then((p) => setMyHandle(p?.username ?? null)).catch(() => {});
    friendBeens()
      .then((all) => {
        const recent = [...all].sort((a, b) => b.visitedAt.localeCompare(a.visitedAt)).slice(0, 15);
        setFeed(recent);
        if (recent.length > 0) {
          getPlaceNames(recent.map((r) => r.placeId)).then(setNames).catch(() => {});
        }
      })
      .catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const debouncedQuery = useDebouncedValue(query, 300);
  useEffect(() => {
    if (!debouncedQuery.trim()) { setResults([]); return; }
    let active = true;
    searchUsers(debouncedQuery).then((r) => { if (active) setResults(r); }).catch(() => {});
    return () => { active = false; };
  }, [debouncedQuery]);

  async function respond(requester: string, accept: boolean) {
    try { await respondFriend(requester, accept); } catch { /* ignore */ }
    load();
  }
  async function addFriend(id: string) {
    setRequested((s) => new Set(s).add(id));
    try { await requestFriend(id); } catch { setRequested((s) => { const n = new Set(s); n.delete(id); return n; }); }
  }
  async function follow(id: string) {
    try { await followUser(id); } catch { /* ignore */ }
    load();
  }
  async function removeFriend(id: string) {
    try { await unfriend(id); } catch { /* ignore */ }
    load();
  }
  async function removeFollow(id: string) {
    try { await unfollowUser(id); } catch { /* ignore */ }
    load();
  }
  function invite() {
    const message = myHandle
      ? `I'm using hungr to map the best food spots. Follow me @${myHandle}: https://usehungr.app`
      : `I'm using hungr to map the best food spots. Join me: https://usehungr.app`;
    Share.share({ message }).catch(() => {});
  }

  const friendIds = new Set(friends.map((u) => u.id));
  const oneWayFollowing = following.filter((u) => !friendIds.has(u.id));
  const followingIds = new Set(following.map((u) => u.id));
  // Split the recent feed: "Friends" shows mutual friends' beens; "Following" shows beens from the
  // people you follow one-way (e.g. the founder), so each tab is a distinct view.
  const feedItems = feed.filter((b) =>
    feedTab === "friends" ? friendIds.has(b.friendId) : followingIds.has(b.friendId) && !friendIds.has(b.friendId),
  );

  return (
    <ScrollView style={s.wrap} contentContainerStyle={[s.content, { paddingTop: insets.top + space.lg }]}>
      <View style={s.titleRow}>
        <Text style={s.h1}>Friends</Text>
        <Pressable style={s.invite} onPress={invite} accessibilityRole="button" accessibilityLabel="Invite friends">
          <Ionicons name="share-outline" size={16} color={colors.onAccent} />
          <Text style={s.inviteTxt}>Invite</Text>
        </Pressable>
      </View>

      <View style={s.search}>
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput
          style={s.input}
          placeholder="Find people by name or @handle"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          value={query}
          onChangeText={setQuery}
        />
      </View>

      {results.length > 0 && (
        <View style={s.section}>
          {results.map((u) => (
            <View key={u.id} style={s.row}>
              <Text style={s.name}>{label(u)}</Text>
              <View style={s.rowActions}>
                <Pressable
                  style={[s.pill, requested.has(u.id) && s.pillMuted]}
                  onPress={() => addFriend(u.id)}
                  disabled={requested.has(u.id)}
                  accessibilityRole="button"
                >
                  <Text style={[s.pillTxt, requested.has(u.id) && s.pillMutedTxt]}>
                    {requested.has(u.id) ? "Requested" : "Add friend"}
                  </Text>
                </Pressable>
                <Pressable style={s.ghostPill} onPress={() => follow(u.id)} accessibilityRole="button">
                  <Text style={s.ghostPillTxt}>Follow</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}

      {requests.length > 0 && (
        <View style={s.section}>
          <Text style={s.label}>Requests</Text>
          {requests.map((u) => (
            <View key={u.id} style={s.row}>
              <Text style={s.name}>{label(u)}</Text>
              <View style={s.rowActions}>
                <Pressable style={s.pill} onPress={() => respond(u.id, true)} accessibilityRole="button">
                  <Text style={s.pillTxt}>Accept</Text>
                </Pressable>
                <Pressable style={s.ghostPill} onPress={() => respond(u.id, false)} accessibilityRole="button">
                  <Text style={s.ghostPillTxt}>Ignore</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}

      {feed.length > 0 && (
        <View style={s.section}>
          <View style={s.feedHead}>
            <Text style={s.label}>Recent</Text>
            <View style={s.feedToggle}>
              <Pressable onPress={() => setFeedTab("friends")} style={[s.feedTab, feedTab === "friends" && s.feedTabOn]} accessibilityRole="button">
                <Text style={[s.feedTabTxt, feedTab === "friends" && s.feedTabTxtOn]}>Friends</Text>
              </Pressable>
              <Pressable onPress={() => setFeedTab("following")} style={[s.feedTab, feedTab === "following" && s.feedTabOn]} accessibilityRole="button">
                <Text style={[s.feedTabTxt, feedTab === "following" && s.feedTabTxtOn]}>Following</Text>
              </Pressable>
            </View>
          </View>
          {feedItems.length === 0 ? (
            <Text style={s.feedEmpty}>
              {feedTab === "friends" ? "No recent activity from friends yet." : "No recent activity from people you follow yet."}
            </Text>
          ) : (
            feedItems.map((b) => (
              <View key={`${b.friendId}-${b.placeId}`} style={s.feedRow}>
                <View style={s.feedDot}>
                  <Ionicons name="restaurant" size={13} color={colors.accentPress} />
                </View>
                <View style={s.feedText}>
                  <Text style={s.feedName} numberOfLines={1}>{names[b.placeId] ?? "A spot worth trying"}</Text>
                  <Text style={s.feedMeta}>{feedLabel(b)} has been · {ago(b.visitedAt)}</Text>
                </View>
              </View>
            ))
          )}
        </View>
      )}

      <View style={s.section}>
        <Text style={s.label}>Your friends</Text>
        {friends.length === 0 ? (
          <View style={s.empty}>
            <View style={s.badge}>
              <Ionicons name="restaurant-outline" size={26} color={colors.accentPress} />
            </View>
            <Text style={s.emptyTitle}>No friends yet</Text>
            <Text style={s.emptySub}>
              Search above for the people whose taste you trust. Friends see where each other have
              been; following someone just shows where they have gone.
            </Text>
          </View>
        ) : (
          friends.map((u) => (
            <View key={u.id} style={s.row}>
              <Text style={s.name}>{label(u)}</Text>
              <View style={s.rowActions}>
                <Ionicons name="people" size={18} color={colors.been} />
                <Pressable style={s.ghostPill} onPress={() => removeFriend(u.id)} accessibilityRole="button">
                  <Text style={s.ghostPillTxt}>Remove</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </View>

      {oneWayFollowing.length > 0 && (
        <View style={s.section}>
          <Text style={s.label}>Following</Text>
          {oneWayFollowing.map((u) => (
            <View key={u.id} style={s.row}>
              <Text style={s.name}>{label(u)}</Text>
              <Pressable style={s.ghostPill} onPress={() => removeFollow(u.id)} accessibilityRole="button">
                <Text style={s.ghostPillTxt}>Unfollow</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: space.xl, paddingBottom: space.xxl, gap: space.md },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  h1: { fontSize: 26, fontWeight: "800", color: colors.ink },
  invite: { flexDirection: "row", alignItems: "center", gap: space.xs, backgroundColor: colors.accent, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 8 },
  inviteTxt: { color: colors.onAccent, fontWeight: "700", fontSize: 13 },
  search: { flexDirection: "row", alignItems: "center", gap: space.sm, backgroundColor: colors.surface, borderColor: colors.hair, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, minHeight: 48 },
  input: { flex: 1, color: colors.ink, paddingVertical: space.md },
  section: { gap: space.xs },
  label: { fontSize: 13, fontWeight: "700", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5, marginTop: space.sm },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md, paddingVertical: space.sm, borderBottomColor: colors.hair, borderBottomWidth: 1 },
  name: { flex: 1, fontSize: 16, fontWeight: "600", color: colors.ink },
  rowActions: { flexDirection: "row", gap: space.xs },
  pill: { backgroundColor: colors.accent, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 8 },
  pillTxt: { color: colors.onAccent, fontWeight: "700", fontSize: 13 },
  pillMuted: { backgroundColor: colors.hair },
  pillMutedTxt: { color: colors.muted },
  ghostPill: { borderColor: colors.hair, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 8 },
  ghostPillTxt: { color: colors.ink, fontWeight: "700", fontSize: 13 },
  empty: { alignItems: "center", gap: space.sm, marginTop: space.lg, paddingHorizontal: space.md },
  badge: { width: 56, height: 56, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderColor: colors.hair, borderWidth: 1, marginBottom: space.sm },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: colors.ink },
  emptySub: { fontSize: 15, color: colors.muted, textAlign: "center", lineHeight: 22 },
  feedHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: space.sm },
  feedToggle: { flexDirection: "row", gap: space.xs, backgroundColor: colors.surface, borderColor: colors.hair, borderWidth: 1, borderRadius: radius.pill, padding: 2 },
  feedTab: { paddingHorizontal: space.md, paddingVertical: 5, borderRadius: radius.pill },
  feedTabOn: { backgroundColor: colors.accent },
  feedTabTxt: { fontSize: 12, fontWeight: "700", color: colors.muted },
  feedTabTxtOn: { color: colors.onAccent },
  feedEmpty: { fontSize: 14, color: colors.muted, paddingVertical: space.sm },
  feedRow: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: space.sm, borderBottomColor: colors.hair, borderBottomWidth: 1 },
  feedDot: { width: 30, height: 30, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderColor: colors.hair, borderWidth: 1 },
  feedText: { flex: 1 },
  feedName: { fontSize: 15, fontWeight: "700", color: colors.ink },
  feedMeta: { fontSize: 13, color: colors.muted, marginTop: 1 },
});
