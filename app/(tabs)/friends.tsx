import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, space } from "../../src/theme";

// Friends feed. The social distribution layer (vertical check-in feed) is a later build.
// For now a warm empty state so the tab is intentional, not a dead end.
export default function Friends() {
  return (
    <View style={s.wrap}>
      <Text style={s.h1}>Friends</Text>
      <View style={s.empty}>
        <View style={s.badge}>
          <Ionicons name="restaurant-outline" size={26} color={colors.accentPress} />
        </View>
        <Text style={s.title}>No check-ins yet</Text>
        <Text style={s.sub}>
          When the people you trust eat somewhere good, their meals land here. Save a few places
          first, then invite the friends whose taste you actually follow.
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.canvas, padding: space.xl, paddingTop: space.xxl },
  h1: { fontSize: 26, fontWeight: "800", color: colors.ink, marginBottom: space.xl },
  empty: { alignItems: "center", gap: space.sm, marginTop: space.xxl, paddingHorizontal: space.md },
  badge: {
    width: 56, height: 56, borderRadius: radius.pill, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.surface, borderColor: colors.hair, borderWidth: 1, marginBottom: space.sm,
  },
  title: { fontSize: 18, fontWeight: "700", color: colors.ink },
  sub: { fontSize: 15, color: colors.muted, textAlign: "center", lineHeight: 22 },
});
