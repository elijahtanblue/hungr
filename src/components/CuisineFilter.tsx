import { ScrollView, Pressable, Text, StyleSheet } from "react-native";
import { colors, radius, space } from "../theme";
import { useFilters } from "../store/useFilters";

export function CuisineFilter({ cuisines }: { cuisines: string[] }) {
  const { selected, suppressed, toggleSelected, toggleSuppressed } = useFilters();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>
      {cuisines.map((c) => {
        const isOn = selected.includes(c);
        const isOff = suppressed.includes(c);
        return (
          <Pressable
            key={c}
            onPress={() => toggleSelected(c)}
            onLongPress={() => toggleSuppressed(c)}
            style={[s.chip, isOn && s.on, isOff && s.off]}
            accessibilityRole="button"
            accessibilityState={{ selected: isOn }}
            accessibilityLabel={isOff ? `Avoiding ${c}` : isOn ? `Filtering to ${c}` : c}
            accessibilityHint="Long press to avoid this cuisine"
          >
            <Text style={[s.txt, isOn && s.onTxt, isOff && s.offTxt]}>
              {isOff ? `Avoid: ${c}` : c}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
const s = StyleSheet.create({
  row: { gap: space.sm, paddingVertical: space.sm },
  chip: { borderColor: colors.hair, borderWidth: 1, backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: space.md, minHeight: 44, justifyContent: "center" },
  on: { backgroundColor: colors.accent, borderColor: colors.accent },
  off: { borderColor: colors.avoid },
  txt: { color: colors.ink, fontSize: 13, fontWeight: "500" },
  onTxt: { color: colors.onAccent },
  offTxt: { color: colors.avoid },
});
