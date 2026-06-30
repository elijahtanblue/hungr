import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, space } from "../theme";
import type { Place } from "../domain/types";

// The list that "Show me" opens: the food spots currently on the map, tappable to jump to a
// place. Closes via the X in the corner or by tapping the backdrop.
export function PlacesListSheet({
  places, onSelect, onClose,
}: { places: Place[]; onSelect: (p: Place) => void; onClose: () => void }) {
  return (
    <View style={s.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close list" />
      <View style={s.sheet}>
        <View style={s.header}>
          <Text style={s.title}>Food near you</Text>
          <Pressable onPress={onClose} style={s.close} accessibilityRole="button" accessibilityLabel="Close" hitSlop={8}>
            <Ionicons name="close" size={18} color={colors.ink} />
          </Pressable>
        </View>
        {places.length === 0 ? (
          <Text style={s.empty}>No spots match your filters here. Try panning the map or clearing a filter.</Text>
        ) : (
          <ScrollView style={s.list} showsVerticalScrollIndicator>
            {places.map((p) => (
              <Pressable key={p.placeId} style={s.row} onPress={() => onSelect(p)} accessibilityRole="button" accessibilityLabel={`Open ${p.name}`}>
                <View style={s.info}>
                  <Text style={s.name} numberOfLines={1}>{p.name}</Text>
                  {p.cuisines.length > 0 && <Text style={s.meta} numberOfLines={1}>{p.cuisines.join(" · ")}</Text>}
                </View>
                {p.rating !== undefined && (
                  <View style={s.rate}>
                    <Ionicons name="star" size={13} color={colors.accentPress} />
                    <Text style={s.rateTxt}>{p.rating}</Text>
                  </View>
                )}
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  backdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "flex-end", backgroundColor: "rgba(28,26,23,0.25)" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: space.lg, paddingBottom: space.xl, maxHeight: "70%" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: space.sm },
  title: { fontSize: 20, fontWeight: "800", color: colors.ink },
  close: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.canvas, borderColor: colors.hair, borderWidth: 1 },
  empty: { fontSize: 14, color: colors.muted, paddingVertical: space.md },
  list: { marginHorizontal: -space.xs },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md, paddingVertical: space.md, paddingHorizontal: space.xs, borderBottomColor: colors.hair, borderBottomWidth: 1 },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: "700", color: colors.ink },
  meta: { fontSize: 13, color: colors.muted, marginTop: 2 },
  rate: { flexDirection: "row", alignItems: "center", gap: 3 },
  rateTxt: { fontSize: 15, fontWeight: "800", color: colors.accentPress },
});
