import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme";
import type { PlaceState } from "../domain/types";

// A clean, food-first pin: a crisp white disc with a state-coloured glyph. Default (unsaved)
// places are golden forks, "been" is a sage check, "avoid" is a clay cross. Deliberately no
// rating number on the pin: it read as dark, cluttered cluster bubbles. Rating lives in the
// place sheet instead.
const stateColor: Record<PlaceState, string> = {
  go: colors.accent, been: colors.been, avoid: colors.avoid,
};
const stateIcon: Record<PlaceState, keyof typeof Ionicons.glyphMap> = {
  go: "bookmark", been: "checkmark", avoid: "close",
};

export function PlacePin({ state }: { state?: PlaceState }) {
  const color = state ? stateColor[state] : colors.accentPress;
  const icon = state ? stateIcon[state] : "restaurant";
  return (
    <View style={[s.pin, { borderColor: color }]}>
      <Ionicons name={icon} size={15} color={color} />
    </View>
  );
}

const s = StyleSheet.create({
  pin: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: colors.surface, borderWidth: 2,
    alignItems: "center", justifyContent: "center",
    shadowColor: colors.ink, shadowOpacity: 0.18, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 3,
  },
});
