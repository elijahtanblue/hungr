import { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, StyleSheet } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getUserProfile, getUserReviews, type UserProfile, type UserReview } from "../../src/api/community";
import { followUser, unfollowUser } from "../../src/api/social";
import { formatRating } from "../../src/lib/formatRating";
import type { PlaceState } from "../../src/domain/types";
import { colors, radius, space } from "../../src/theme";

const STATE_LABELS = { liked: "Liked", loved: "Loved", disliked: "Disliked" };

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={s.stat}>
      <Text style={s.statNum}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function stateChipStyle(state: Exclude<PlaceState, "go">) {
  if (state === "liked") return s.likedChip;
  if (state === "loved") return s.lovedChip;
  return s.dislikedChip;
}

export default function Profile() {
  const insets = useSafeAreaInsets();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [reviews, setReviews] = useState<UserReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    Promise.all([getUserProfile(userId), getUserReviews(userId)])
      .then(([p, r]) => { if (active) { setProfile(p); setReviews(r); } })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId]);

  async function toggleFollow() {
    if (!profile || busy) return;
    const next = !profile.isFollowing;
    setBusy(true);
    // Optimistic.
    setProfile({ ...profile, isFollowing: next, followers: profile.followers + (next ? 1 : -1) });
    try {
      if (next) await followUser(profile.id);
      else await unfollowUser(profile.id);
    } catch {
      setProfile((p) => (p ? { ...p, isFollowing: !next, followers: p.followers + (next ? -1 : 1) } : p));
    } finally {
      setBusy(false);
    }
  }

  const name = profile?.username ? `@${profile.username}` : profile?.displayName ?? "Someone";

  return (
    <View style={s.wrap}>
      <View style={[s.header, { paddingTop: insets.top + space.sm }]}>
        <Pressable onPress={() => router.back()} style={s.back} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </Pressable>
        <Text style={s.title} numberOfLines={1}>{name}</Text>
      </View>

      <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + space.xxl }]}>
        {loading ? (
          <ActivityIndicator color={colors.accentPress} style={s.loader} />
        ) : !profile ? (
          <Text style={s.empty}>This profile isn't available.</Text>
        ) : (
          <>
            <View style={s.avatar}>
              <Ionicons name="person" size={34} color={colors.accentPress} />
            </View>
            <Text style={s.name}>{name}</Text>
            <View style={s.stats}>
              <Stat label="Followers" value={profile.followers} />
              <Stat label="Following" value={profile.following} />
            </View>
            <Pressable
              style={[s.followBtn, profile.isFollowing && s.followingBtn]}
              onPress={toggleFollow}
              disabled={busy}
              accessibilityRole="button"
            >
              <Text style={[s.followTxt, profile.isFollowing && s.followingTxt]}>{profile.isFollowing ? "Following" : "Follow"}</Text>
            </Pressable>

            <Text style={s.sectionLabel}>Reviews</Text>
            {reviews.length === 0 ? (
              <Text style={s.empty}>No reviews yet.</Text>
            ) : (
              reviews.map((r) => (
                <Pressable
                  key={r.id}
                  style={s.review}
                  onPress={() => router.push({ pathname: "/place/[placeId]", params: { placeId: r.placeId } })}
                  accessibilityRole="button"
                >
                  <View style={s.reviewHead}>
                    <Text style={s.reviewPlace} numberOfLines={1}>{r.placeName}</Text>
                    {r.placeRating !== null && <Text style={s.reviewRating}>{"★"} {formatRating(r.placeRating)}</Text>}
                  </View>
                  {r.state && <Text style={[s.reviewState, stateChipStyle(r.state)]}>{STATE_LABELS[r.state]}</Text>}
                  {!!r.body && <Text style={s.reviewBody} numberOfLines={4}>{r.body}</Text>}
                  {r.upvotes > 0 && <Text style={s.upvotes}>{"▲"} {r.upvotes}</Text>}
                </Pressable>
              ))
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.canvas },
  header: {
    flexDirection: "row", alignItems: "center", gap: space.xs, paddingHorizontal: space.md,
    paddingBottom: space.sm, borderBottomColor: colors.hair, borderBottomWidth: 1, backgroundColor: colors.surface,
  },
  back: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 18, fontWeight: "800", color: colors.ink, flexShrink: 1 },
  content: { padding: space.xl, alignItems: "center" },
  loader: { marginTop: space.xxl },
  avatar: { width: 84, height: 84, borderRadius: 42, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderColor: colors.hair, borderWidth: 1 },
  name: { fontSize: 22, fontWeight: "800", color: colors.ink, marginTop: space.md },
  stats: { flexDirection: "row", gap: space.xl, marginTop: space.lg },
  stat: { alignItems: "center" },
  statNum: { fontSize: 20, fontWeight: "800", color: colors.ink },
  statLabel: { fontSize: 12, color: colors.muted, fontWeight: "600", marginTop: 2 },
  followBtn: { marginTop: space.lg, marginBottom: space.xl, backgroundColor: colors.accent, borderRadius: radius.pill, paddingHorizontal: space.xxl, paddingVertical: space.sm, minWidth: 160, alignItems: "center" },
  followingBtn: { backgroundColor: colors.surface, borderColor: colors.hair, borderWidth: 1 },
  followTxt: { color: colors.onAccent, fontWeight: "800", fontSize: 15 },
  followingTxt: { color: colors.ink },
  sectionLabel: { alignSelf: "stretch", fontSize: 13, fontWeight: "700", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: space.sm },
  empty: { fontSize: 14, color: colors.muted, textAlign: "center", marginTop: space.lg },
  review: { alignSelf: "stretch", backgroundColor: colors.surface, borderColor: colors.hair, borderWidth: 1, borderRadius: radius.md, padding: space.md, marginBottom: space.sm, gap: 4 },
  reviewHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm },
  reviewPlace: { flex: 1, fontSize: 15, fontWeight: "700", color: colors.ink },
  reviewRating: { color: colors.accentPress, fontWeight: "800" },
  reviewState: { alignSelf: "flex-start", color: "#fff", backgroundColor: colors.canvas, borderColor: colors.hair, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 3, fontSize: 12, fontWeight: "800", overflow: "hidden" },
  likedChip: { backgroundColor: colors.been, borderColor: colors.been },
  lovedChip: { backgroundColor: colors.loved, borderColor: colors.loved },
  dislikedChip: { backgroundColor: colors.avoid, borderColor: colors.avoid },
  reviewBody: { fontSize: 14, color: colors.ink, lineHeight: 20 },
  upvotes: { fontSize: 12, color: colors.muted, fontWeight: "700" },
});
