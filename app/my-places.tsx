import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getMyPlaces, type MyPlace, type MyPlaces as MyPlacesGroups } from "../src/api/myPlaces";
import { colors, radius, space } from "../src/theme";

const emptyGroups: MyPlacesGroups = { go: [], been: [], avoid: [] };

function PlaceRow({ place }: { place: MyPlace }) {
  return (
    <Pressable
      style={s.row}
      onPress={() => router.push({ pathname: "/place/[placeId]", params: { placeId: place.placeId } })}
      accessibilityRole="button"
    >
      <View style={s.rowText}>
        <View style={s.nameRow}>
          <Text style={s.name}>{place.name}</Text>
          {place.rating !== null && <Text style={s.rating}>{"★"} {place.rating}</Text>}
        </View>
        {place.note && <Text style={s.meta}>{place.note}</Text>}
        {place.avoidReason && <Text style={s.meta}>{place.avoidReason}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

function Section({ title, places }: { title: string; places: MyPlace[] }) {
  return (
    <View style={s.section}>
      <Text style={s.label}>{title}</Text>
      {places.length === 0 ? (
        <Text style={s.empty}>Nothing here yet.</Text>
      ) : (
        places.map((place) => <PlaceRow key={place.placeId} place={place} />)
      )}
    </View>
  );
}

export default function MyPlaces() {
  const insets = useSafeAreaInsets();
  const [places, setPlaces] = useState<MyPlacesGroups>(emptyGroups);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getMyPlaces()
      .then((next) => { if (active) setPlaces(next); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

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
      <ScrollView contentContainerStyle={[s.content, { paddingTop: insets.top + space.xxl }]}>
        <Text style={s.h1}>My places</Text>
        {loading ? (
          <ActivityIndicator color={colors.accentPress} style={s.loader} />
        ) : (
          <>
            <Section title="Want to go" places={places.go} />
            <Section title="Been" places={places.been} />
            <Section title="Avoid" places={places.avoid} />
          </>
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
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl },
  h1: { fontSize: 26, fontWeight: "800", color: colors.ink, marginLeft: 52 },
  loader: { marginTop: space.xxl },
  section: { gap: space.xs },
  label: { fontSize: 15, fontWeight: "800", color: colors.ink },
  empty: { fontSize: 14, color: colors.muted, paddingVertical: space.sm },
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
