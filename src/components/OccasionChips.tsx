import { ScrollView, Pressable, Text, StyleSheet } from "react-native";
import { OCCASIONS, type Occasion } from "../domain/occasionPresets";
import { colors, radius, space, fonts } from "../theme";

type Props = {
  activeId: string | null;
  onPick: (occasion: Occasion | null) => void;
};

// Horizontal row of occasion chips. Tapping a chip picks that occasion; tapping the active
// chip again clears it. Sits under the search bar, next to the cuisine filter.
export function OccasionChips({ activeId, onPick }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.row}
      keyboardShouldPersistTaps="handled"
    >
      {OCCASIONS.map((o) => {
        const on = o.id === activeId;
        return (
          <Pressable
            key={o.id}
            onPress={() => onPick(on ? null : o)}
            style={[s.chip, on && s.chipOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={o.label}
          >
            <Text style={[s.txt, on && s.txtOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  row: { gap: space.sm, paddingVertical: space.sm },
  chip: {
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hair,
  },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  txt: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.ink },
  txtOn: { color: colors.onAccent },
});
