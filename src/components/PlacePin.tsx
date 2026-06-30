import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme";
import type { PlaceState } from "../domain/types";
import { formatRating } from "../lib/formatRating";

// Balloon markers: an amber bubble showing the rating number (it is all food, so no food glyph
// needed), with a small stem. Sentiments get a tinted bubble and glyph: liked sage thumbs-up,
// loved pink heart, disliked clay thumbs-down. The amber pin darkens when selected.
const bubbleColor: Record<PlaceState, string> = {
  go: colors.accent, liked: colors.been, loved: colors.loved, disliked: colors.avoid,
};

export function PlacePin({ state, rating, selected, guideAward }: { state?: PlaceState; rating?: number; selected?: boolean; guideAward?: string }) {
  const isAmber = !state || state === "go";
  const bg = isAmber ? (selected ? "#F59E0B" : colors.accent) : bubbleColor[state!];
  return (
    <View style={s.wrap}>
      <View testID={state === "go" ? "place-pin-go" : undefined} style={[s.bubble, { backgroundColor: bg }, selected && s.selected]}>
        {guideAward && (
          <View style={s.guideBadge} testID="place-pin-guide" accessibilityLabel={guideAward}>
            <Ionicons name="ribbon" size={9} color={colors.ink} />
          </View>
        )}
        {state === "go" ? (
          <Ionicons name="bookmark" size={14} color={colors.onAccent} />
        ) : state === "liked" ? (
          <Ionicons name="thumbs-up" size={14} color="#fff" />
        ) : state === "loved" ? (
          <Ionicons name="heart" size={14} color="#fff" />
        ) : state === "disliked" ? (
          <Ionicons name="thumbs-down" size={14} color="#fff" />
        ) : rating !== undefined ? (
          <Text style={s.num}>{formatRating(rating)}</Text>
        ) : (
          // No Google rating yet: a small neutral dot, not a star (a bare star read as a rating).
          <Ionicons name="ellipse" size={6} color={colors.onAccent} />
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
  guideBadge: {
    position: "absolute", top: -7, right: -7, width: 16, height: 16, borderRadius: 8,
    backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.accent,
  },
  stem: {
    width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 7,
    borderLeftColor: "transparent", borderRightColor: "transparent", marginTop: -2,
  },
  num: { fontSize: 13, fontWeight: "800", color: colors.onAccent },
});
