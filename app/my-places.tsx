import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getMyPlaces, type MyPlace, type MyPlaces as MyPlacesGroups } from "../src/api/myPlaces";
import type { PlaceState } from "../src/domain/types";
import { formatRating } from "../src/lib/formatRating";
import { colors, radius, space } from "../src/theme";

const emptyGroups: MyPlacesGroups = { go: [], liked: [], loved: [], disliked: [] };

// Tabs across the top, one place group at a time.
const TABS: { state: PlaceState; label: string; color: string }[] = [
  { state: "go", label: "Want to go", color: colors.accentPress },
  { state: "liked", label: "Liked", color: colors.been },
  { state: "loved", label: "Loved", color: colors.loved },
  { state: "disliked", label: "Disliked", color: colors.avoid },
];

type Sort = "recent" | "rating";
const SORTS: { key: Sort; label: string }[] = [
  { key: "recent", label: "Recent" },
  { key: "rating", label: "Rating" },
];

function sortPlaces(places: MyPlace[], sort: Sort): MyPlace[] {
  const copy = [...places];
  if (sort === "rating") {
    // Highest restaurant ratings first; unrated places fall to the bottom.
    copy.sort((a, b) => (b.placeRating ?? -1) - (a.placeRating ?? -1));
  } else {
    copy.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  return copy;
}

function PlaceRow({ place }: { place: MyPlace }) {
  return (
    <Pressable
      style={s.row}
      onPress={() => router.push({ pathname: "/place/[placeId]", params: { placeId: place.placeId } })}
      accessibilityRole="button"
    >
      <View style={s.rowText}>
        <View style={s.nameRow}>
          <Text style={s.name} numberOfLines={1}>{place.name}</Text>
          {place.placeRating !== null && <Text style={s.rating}>{"★"} {formatRating(place.placeRating)}</Text>}
        </View>
        {place.note && <Text style={s.meta} numberOfLines={1}>{place.note}</Text>}
        {place.avoidReason && <Text style={s.meta} numberOfLines={1}>{place.avoidReason}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

export default function MyPlaces() {
  const insets = useSafeAreaInsets();
  const [places, setPlaces] = useState<MyPlacesGroups>(emptyGroups);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<PlaceState>("go");
  const [sort, setSort] = useState<Sort>("recent");

  useEffect(() => {
    let active = true;
    getMyPlaces()
      .then((next) => { if (active) setPlaces(next); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const rows = useMemo(() => sortPlaces(places[tab], sort), [places, tab, sort]);

  return (
    <View style={s.wrap}>
      <Pressable
        style={[s.back, { top: insets.top + space.xs }]}
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <Ionicons name="chevron-back" size={22} color={colors.ink} />
      </Pressable>
      <View style={[s.head, { paddingTop: insets.top + space.xxl }]}>
        <Text style={s.h1}>My places</Text>
        <View style={s.tabs}>
          {TABS.map((t) => {
            const on = tab === t.state;
            return (
              <Pressable key={t.state} onPress={() => setTab(t.state)} style={[s.tab, on && { backgroundColor: t.color }]} accessibilityRole="button">
                <Text style={[s.tabTxt, on && s.tabTxtOn]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={s.sortRow}>
          <Text style={s.sortLabel}>Sort</Text>
          {SORTS.map((opt) => (
            <Pressable key={opt.key} onPress={() => setSort(opt.key)} style={[s.sortPill, sort === opt.key && s.sortPillOn]} accessibilityRole="button">
              <Text style={[s.sortTxt, sort === opt.key && s.sortTxtOn]}>{opt.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <ScrollView contentContainerStyle={s.content}>
        {loading ? (
          <ActivityIndicator color={colors.accentPress} style={s.loader} />
        ) : rows.length === 0 ? (
          <Text style={s.empty}>Nothing here yet.</Text>
        ) : (
          rows.map((place) => <PlaceRow key={place.placeId} place={place} />)
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.canvas },
  back: {
    position: "absolute", left: space.md, zIndex: 2, width: 40, height: 40, borderRadius: 99,
    alignItems: "center", justifyContent: "center", backgroundColor: colors.surface,
    borderColor: colors.hair, borderWidth: 1,
  },
  head: { paddingHorizontal: space.lg, gap: space.md, paddingBottom: space.md, borderBottomColor: colors.hair, borderBottomWidth: 1 },
  h1: { fontSize: 26, fontWeight: "800", color: colors.ink, textAlign: "center" },
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: space.xs, justifyContent: "center" },
  tab: { paddingHorizontal: space.md, paddingVertical: 7, borderRadius: radius.pill, borderColor: colors.hair, borderWidth: 1, backgroundColor: colors.surface },
  tabTxt: { fontSize: 13, fontWeight: "700", color: colors.muted },
  tabTxtOn: { color: "#fff" },
  sortRow: { flexDirection: "row", alignItems: "center", gap: space.xs, justifyContent: "center" },
  sortLabel: { fontSize: 12, color: colors.muted, fontWeight: "700", marginRight: space.xs },
  sortPill: { paddingHorizontal: space.md, paddingVertical: 5, borderRadius: radius.pill, borderColor: colors.hair, borderWidth: 1 },
  sortPillOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  sortTxt: { fontSize: 12, fontWeight: "700", color: colors.muted },
  sortTxtOn: { color: colors.surface },
  content: { padding: space.lg, gap: space.xs, paddingBottom: space.xxl },
  loader: { marginTop: space.xxl },
  empty: { fontSize: 14, color: colors.muted, paddingVertical: space.lg, textAlign: "center" },
  row: {
    flexDirection: "row", alignItems: "center", gap: space.sm, backgroundColor: colors.surface,
    borderColor: colors.hair, borderWidth: 1, borderRadius: radius.md, padding: space.md,
  },
  rowText: { flex: 1, gap: 3 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  name: { flex: 1, fontSize: 16, fontWeight: "700", color: colors.ink },
  rating: { color: colors.accentPress, fontWeight: "800" },
  meta: { fontSize: 13, color: colors.muted, lineHeight: 18 },
});
