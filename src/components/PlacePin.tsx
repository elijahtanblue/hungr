import { View, Text, StyleSheet } from "react-native";
import { colors, radius } from "../theme";
import type { PlaceState } from "../domain/types";

const stateColor: Record<PlaceState, string> = {
  go: colors.accent, been: colors.been, avoid: colors.avoid,
};
export function PlacePin({ state, label }: { state?: PlaceState; label: string }) {
  const bg = state ? stateColor[state] : colors.muted;
  return (
    <View style={[s.pin, { backgroundColor: bg }]}>
      <Text style={[s.txt, state === "go" || !state ? { color: colors.onAccent } : { color: "#fff" }]}>{label}</Text>
    </View>
  );
}
const s = StyleSheet.create({
  pin: { minWidth: 34, height: 28, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  txt: { fontSize: 12, fontWeight: "700" },
});
