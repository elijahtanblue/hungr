import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { colors, radius, space } from "../theme";
import { useFilters } from "../store/useFilters";
import { saveSuppressedCuisines } from "../api/preferences";

// State 3 from DESIGN.md: a bottom sheet to set taste. Prioritise (golden) floats results to
// the top, Avoid (clay) hides them on the map. The avoid list persists to the user's profile.
export function PreferencesSheet({ cuisines, onClose }: { cuisines: string[]; onClose: () => void }) {
  const selected = useFilters((s) => s.selected);
  const suppressed = useFilters((s) => s.suppressed);
  const setPreference = useFilters((s) => s.setPreference);

  function choose(c: string, isOn: boolean, target: "prioritise" | "avoid") {
    setPreference(c, isOn ? "neutral" : target);
    // Persist the avoid list from the freshly updated store state.
    saveSuppressedCuisines(useFilters.getState().suppressed);
  }

  return (
    <View style={s.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close preferences" />
      <View style={s.sheet}>
        <View style={s.grab} />
        <View style={s.header}>
          <Text style={s.title}>Your taste</Text>
          <Pressable onPress={onClose} accessibilityRole="button">
            <Text style={s.done}>Done</Text>
          </Pressable>
        </View>
        <Text style={s.help}>Prioritise what you love. Avoid what you never want to see.</Text>
        <ScrollView style={s.list} showsVerticalScrollIndicator={false}>
          {cuisines.map((c) => {
            const isP = selected.includes(c);
            const isA = suppressed.includes(c);
            return (
              <View key={c} style={s.row}>
                <Text style={s.name}>{c}</Text>
                <View style={s.actions}>
                  <Pressable onPress={() => choose(c, isP, "prioritise")} style={[s.pill, isP && s.pillP]}>
                    <Text style={[s.pillTxt, isP && s.pillPTxt]}>Prioritise</Text>
                  </Pressable>
                  <Pressable onPress={() => choose(c, isA, "avoid")} style={[s.pill, isA && s.pillA]}>
                    <Text style={[s.pillTxt, isA && s.pillATxt]}>Avoid</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  backdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "flex-end", backgroundColor: "rgba(28,26,23,0.25)" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: space.lg, paddingBottom: space.xl },
  grab: { width: 34, height: 4, borderRadius: 99, backgroundColor: colors.hair, alignSelf: "center", marginBottom: space.md },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 20, fontWeight: "800", color: colors.ink },
  done: { fontSize: 16, fontWeight: "700", color: colors.accentPress },
  help: { fontSize: 14, color: colors.muted, marginTop: 2, marginBottom: space.md },
  list: { maxHeight: 360 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: space.sm, borderBottomColor: colors.hair, borderBottomWidth: 1 },
  name: { fontSize: 16, fontWeight: "600", color: colors.ink },
  actions: { flexDirection: "row", gap: space.sm },
  pill: { borderColor: colors.hair, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 6 },
  pillP: { backgroundColor: colors.accent, borderColor: colors.accent },
  pillA: { borderColor: colors.avoid },
  pillTxt: { fontSize: 12, fontWeight: "600", color: colors.muted },
  pillPTxt: { color: colors.onAccent },
  pillATxt: { color: colors.avoid },
});
