import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme";
import type { PlaceState } from "../domain/types";

// Balloon markers: an amber bubble showing the rating number (it is all food, so no food
// glyph needed), with a small stem. "Been" is a sage check, "avoid" a clay cross. The amber
// pin darkens when selected. Mirrors the reference map UI.
const bubbleColor: Record<PlaceState, string> = {
  go: colors.accent, been: colors.been, avoid: colors.avoid,
};

export function PlacePin({ state, rating, selected }: { state?: PlaceState; rating?: number; selected?: boolean }) {
  const isAmber = !state || state === "go";
  const bg = isAmber ? (selected ? "#F59E0B" : colors.accent) : bubbleColor[state!];
  return (
    <View style={s.wrap}>
      <View testID={state === "go" ? "place-pin-go" : undefined} style={[s.bubble, { backgroundColor: bg }, selected && s.selected]}>
        {state === "go" ? (
          <Ionicons name="bookmark" size={14} color={colors.onAccent} />
        ) : state === "been" ? (
          <Ionicons name="checkmark" size={15} color="#fff" />
        ) : state === "avoid" ? (
          <Ionicons name="close" size={15} color="#fff" />
        ) : (
          <Text style={s.num}>{rating !== undefined ? rating : "★"}</Text>
        )}
      </View>
      <View style={[s.stem, { borderTopColor: bg }]} />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: "center" },
  bubble: {
    minWidth: 36, height: 28, borderRadius: 14, paddingHorizontal: 8, alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: colors.surface,
    shadowColor: colors.ink, shadowOpacity: 0.2, shadowRadius: 2.5, shadowOffset: { width: 0, height: 1 }, elevation: 3,
  },
  selected: { transform: [{ scale: 1.12 }], borderColor: colors.ink, borderWidth: 2 },
  stem: {
    width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 7,
    borderLeftColor: "transparent", borderRightColor: "transparent", marginTop: -2,
  },
  num: { fontSize: 13, fontWeight: "800", color: colors.onAccent },
});
