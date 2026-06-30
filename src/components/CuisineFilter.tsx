import { ScrollView, Pressable, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, space } from "../theme";
import { useFilters } from "../store/useFilters";

// Front-of-map chips show ONLY the cuisines the user has chosen to prioritise, so the map
// stays uncluttered. Full prioritise/avoid management lives in the preferences sheet (the
// filter icon). Tapping a chip clears that priority. Renders nothing when none are set.
export function CuisineFilter() {
  const selected = useFilters((s) => s.selected);
  const toggleSelected = useFilters((s) => s.toggleSelected);
  if (selected.length === 0) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>
      {selected.map((c) => (
        <Pressable
          key={c}
          onPress={() => toggleSelected(c)}
          style={s.chip}
          accessibilityRole="button"
          accessibilityState={{ selected: true }}
          accessibilityLabel={`Prioritising ${c}. Tap to clear.`}
        >
          <Text style={s.txt}>{c}</Text>
          <Ionicons name="close" size={13} color={colors.onAccent} />
        </Pressable>
      ))}
    </ScrollView>
  );
}
const s = StyleSheet.create({
  row: { gap: space.sm, paddingVertical: space.sm },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.accent, borderRadius: radius.pill, paddingHorizontal: space.md, minHeight: 40, justifyContent: "center" },
  txt: { color: colors.onAccent, fontSize: 13, fontWeight: "600" },
});
