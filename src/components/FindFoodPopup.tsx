import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, space } from "../theme";

// State 2 from DESIGN.md: an AI styled popup that rises over the map. A one line summary, a
// "Show me" affordance that opens the list of nearby spots, and an X to dismiss.
export function FindFoodPopup({
  count, onShowList, onClose,
}: { count: number; onShowList: () => void; onClose: () => void }) {
  return (
    <View style={s.layer} pointerEvents="box-none">
      <View style={s.card}>
        <View style={s.headRow}>
          <View style={s.titleWrap}>
            <Ionicons name="sparkles" size={18} color={colors.accentPress} />
            <Text style={s.title}>Food near you</Text>
          </View>
          <Pressable onPress={onClose} style={s.close} accessibilityRole="button" accessibilityLabel="Dismiss" hitSlop={8}>
            <Ionicons name="close" size={18} color={colors.ink} />
          </Pressable>
        </View>
        <Text style={s.summary}>
          {count <= 0
            ? "Looking for spots near you..."
            : count >= 20
            ? "Lots of spots near you. The pins are your picks."
            : `${count} ${count === 1 ? "spot" : "spots"} near you. The pins are your picks.`}
        </Text>
        <Pressable style={s.cta} onPress={onShowList} accessibilityRole="button">
          <Text style={s.ctaTxt}>Show me</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  layer: { position: "absolute", left: 0, right: 0, bottom: 0, alignItems: "center", paddingBottom: space.xxl },
  card: {
    backgroundColor: colors.surface, borderColor: colors.hair, borderWidth: 1, borderRadius: radius.lg,
    padding: space.md, gap: space.sm, width: "88%", shadowColor: colors.ink, shadowOpacity: 0.12,
    shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  headRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  titleWrap: { flexDirection: "row", alignItems: "center", gap: space.xs },
  title: { fontSize: 16, fontWeight: "800", color: colors.ink },
  close: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: colors.canvas, borderColor: colors.hair, borderWidth: 1 },
  summary: { fontSize: 15, color: colors.muted, lineHeight: 21 },
  cta: { backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: space.sm, alignItems: "center", minHeight: 44, justifyContent: "center" },
  ctaTxt: { color: colors.onAccent, fontWeight: "700" },
});
