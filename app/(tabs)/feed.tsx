import { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getFollowingFeed, type FeedReview } from "../../src/api/feed";
import { getWeeklyPlaceTrends, getLocalTrendCards, type LocalTrendCard } from "../../src/api/localTrends";
import { getPlaceNames } from "../../src/api/placeNames";
import { recordTrendFollowTaste } from "../../src/api/tasteTracking";
import { colors, radius, space } from "../../src/theme";

type Scope = "feed" | "local";

function authorLabel(f: FeedReview): string {
  return f.authorUsername ? `@${f.authorUsername}` : f.authorName ?? "Someone";
}

function ago(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return "";
  const day = Math.floor(ms / 86400000);
  if (day >= 1) return `${day}d ago`;
  const hr = Math.floor(ms / 3600000);
  if (hr >= 1) return `${hr}h ago`;
  const min = Math.floor(ms / 60000);
  return min >= 1 ? `${min}m ago` : "just now";
}

// The meta line under a feed item: rating, photo count, and age, only the parts that apply.
function reviewMeta(f: FeedReview): string {
  const parts: string[] = [];
  if (f.rating != null) parts.push(`★ ${f.rating}`);
  if (f.photoCount > 0) parts.push(`${f.photoCount} photo${f.photoCount === 1 ? "" : "s"}`);
  const when = ago(f.createdAt);
  if (when) parts.push(when);
  return parts.join(" · ");
}

function openPlace(placeId: string) {
  router.push({ pathname: "/place/[placeId]", params: { placeId } });
}

// Opening a place from Local trends is itself a taste signal (the "Follower" trait). Fire and forget.
function openTrendPlace(placeId: string) {
  recordTrendFollowTaste(placeId).catch(() => {});
  openPlace(placeId);
}

// Feed. Two separate rails: "Feed" is people you follow posting reviews and photos; "Local trends"
// is our own nearby-food signal (places gaining reviews, check-ins, and saves this week).
export default function Feed() {
  const insets = useSafeAreaInsets();
  const [scope, setScope] = useState<Scope>("feed");
  const [reviews, setReviews] = useState<FeedReview[]>([]);
  const [cards, setCards] = useState<LocalTrendCard[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const mergeNames = useCallback((ids: string[]) => {
    const missing = ids.filter((id) => id);
    if (missing.length === 0) return;
    getPlaceNames(missing).then((n) => setNames((prev) => ({ ...prev, ...n }))).catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      const [feed, weekly] = await Promise.all([
        getFollowingFeed(30).catch(() => []),
        getWeeklyPlaceTrends({ limit: 40 }).catch(() => []),
      ]);
      // Weekly trends give the active place_ids; the card RPC turns those into a few anonymized,
      // editorial trend cards (headline + summary) rather than a raw ranked list.
      const trendCards = weekly.length
        ? await getLocalTrendCards(weekly.map((t) => t.placeId), { limit: 6 }).catch(() => [])
        : [];
      if (!active) return;
      setReviews(feed);
      setCards(trendCards);
      mergeNames([...feed.map((f) => f.placeId), ...trendCards.map((c) => c.placeId)]);
    })().finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [mergeNames]);

  const nameOf = (placeId: string) => names[placeId] ?? "A place";
  const items = scope === "feed" ? reviews : cards;

  return (
    <View testID="feed-screen" style={[s.wrap, { paddingTop: insets.top + space.lg }]}>
      <Text style={s.h1}>Feed</Text>
      <View style={s.toggle}>
        <Pressable onPress={() => setScope("feed")} style={[s.seg, scope === "feed" && s.segOn]} accessibilityRole="button">
          <Text style={[s.segTxt, scope === "feed" && s.segTxtOn]}>Feed</Text>
        </Pressable>
        <Pressable onPress={() => setScope("local")} style={[s.seg, scope === "local" && s.segOn]} accessibilityRole="button">
          <Text style={[s.segTxt, scope === "local" && s.segTxtOn]}>Local trends</Text>
        </Pressable>
      </View>

      {!loading && items.length === 0 ? (
        <View style={s.empty}>
          <View style={s.badge}>
            <Ionicons name={scope === "feed" ? "newspaper-outline" : "trending-up-outline"} size={26} color={colors.accentPress} />
          </View>
          <Text style={s.title}>{scope === "feed" ? "No posts yet" : "Nothing trending nearby yet"}</Text>
          <Text style={s.sub}>
            {scope === "feed"
              ? "When people you follow post reviews and photos, they show up here. Follow a few friends to get started."
              : "Places getting more saves, reviews, and visits nearby will appear here once there is enough signal."}
          </Text>
        </View>
      ) : (
        <ScrollView style={s.list} contentContainerStyle={s.listInner} showsVerticalScrollIndicator>
          {scope === "feed"
            ? reviews.map((f) => (
                <Pressable
                  key={f.reviewId}
                  style={s.row}
                  onPress={() => openPlace(f.placeId)}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${nameOf(f.placeId)}`}
                >
                  <View style={s.avatar}>
                    <Ionicons name={f.photoCount > 0 ? "image" : "chatbubble-ellipses"} size={16} color={colors.accentPress} />
                  </View>
                  <View style={s.rowInfo}>
                    <Text style={s.rowTitle} numberOfLines={1}>
                      <Text style={s.strong}>{authorLabel(f)}</Text> reviewed <Text style={s.strong}>{nameOf(f.placeId)}</Text>
                    </Text>
                    {!!f.body && <Text style={s.rowBody} numberOfLines={1}>{f.body}</Text>}
                    <Text style={s.rowMeta}>{reviewMeta(f)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                </Pressable>
              ))
            : cards.map((c) => (
                <Pressable
                  key={c.placeId}
                  style={s.card}
                  onPress={() => openTrendPlace(c.placeId)}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${nameOf(c.placeId)}`}
                >
                  <Text style={s.cardHeadline}>{c.headline}</Text>
                  <Text style={s.cardPlace} numberOfLines={1}>{nameOf(c.placeId)}</Text>
                  <Text style={s.cardSummary}>{c.summary}</Text>
                </Pressable>
              ))}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.canvas, padding: space.xl },
  h1: { fontSize: 26, fontWeight: "800", color: colors.ink, marginBottom: space.lg },
  toggle: { flexDirection: "row", backgroundColor: colors.surface, borderColor: colors.hair, borderWidth: 1, borderRadius: radius.pill, padding: 3, alignSelf: "flex-start" },
  seg: { paddingVertical: space.sm, paddingHorizontal: space.lg, borderRadius: radius.pill },
  segOn: { backgroundColor: colors.accent },
  segTxt: { fontSize: 13, fontWeight: "600", color: colors.muted },
  segTxtOn: { color: colors.onAccent },
  list: { marginTop: space.lg, marginHorizontal: -space.xs },
  listInner: { paddingBottom: space.xxl },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.md, paddingHorizontal: space.xs, borderBottomColor: colors.hair, borderBottomWidth: 1 },
  avatar: { width: 34, height: 34, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderColor: colors.hair, borderWidth: 1 },
  card: { backgroundColor: colors.surface, borderColor: colors.hair, borderWidth: 1, borderRadius: radius.md, padding: space.md, marginBottom: space.sm, gap: 4 },
  cardHeadline: { fontSize: 16, fontWeight: "800", color: colors.accentPress },
  cardPlace: { fontSize: 15, fontWeight: "700", color: colors.ink },
  cardSummary: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  rowInfo: { flex: 1 },
  rowTitle: { fontSize: 15, color: colors.ink },
  strong: { fontWeight: "800", color: colors.ink },
  rowBody: { fontSize: 14, color: colors.ink, marginTop: 2 },
  rowMeta: { fontSize: 13, color: colors.muted, marginTop: 2 },
  empty: { alignItems: "center", gap: space.sm, marginTop: space.xxl, paddingHorizontal: space.md },
  badge: {
    width: 56, height: 56, borderRadius: radius.pill, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.surface, borderColor: colors.hair, borderWidth: 1, marginBottom: space.sm,
  },
  title: { fontSize: 18, fontWeight: "700", color: colors.ink, textAlign: "center" },
  sub: { fontSize: 15, color: colors.muted, textAlign: "center", lineHeight: 22 },
});
