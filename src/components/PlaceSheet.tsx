import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, space } from "../theme";
import type { Place, PlaceState } from "../domain/types";

export function PlaceSheet({
  place, onSetState, onOpenDetail, visitCount, onCheckIn,
}: {
  place: Place;
  onSetState: (placeId: string, state: PlaceState) => void;
  onOpenDetail?: (placeId: string) => void;
  visitCount?: number;
  onCheckIn?: () => void;
}) {
  const isGo = place.state === "go";
  const isBeen = place.state === "been";
  const isAvoid = place.state === "avoid";
  return (
    <View style={s.sheet}>
      <View style={s.grab} />
      <View style={s.row}>
        <View style={s.headText}>
          <Text style={s.name}>{place.name}</Text>
          {place.cuisines.length > 0 && <Text style={s.meta}>{place.cuisines.join(" · ")}</Text>}
        </View>
        {place.rating !== undefined && (
          <View style={s.rate}>
            <Ionicons name="star" size={18} color={colors.accentPress} />
            <Text style={s.rateNum}>{place.rating}</Text>
          </View>
        )}
      </View>
      <View style={s.actions}>
        <Pressable style={[s.btn, !place.state && s.primary, isGo && s.selected]} onPress={() => onSetState(place.placeId, "go")} accessibilityRole="button" accessibilityLabel={`Mark ${place.name} as want to go`}>
          <Text style={[s.btnTxt, !place.state && s.primaryTxt, isGo && s.selectedTxt]}>{isGo ? "Saved" : "Want to go"}</Text>
        </Pressable>
        <Pressable style={[s.btn, isBeen && s.selected]} onPress={() => onSetState(place.placeId, "been")} accessibilityRole="button" accessibilityLabel={`Mark ${place.name} as been`}>
          <Text style={[s.btnTxt, isBeen && s.selectedTxt]}>Been</Text>
        </Pressable>
        <Pressable style={[s.btn, isAvoid && s.selected]} onPress={() => onSetState(place.placeId, "avoid")} accessibilityRole="button" accessibilityLabel={`Mark ${place.name} as avoid`}>
          <Text style={[s.btnTxt, isAvoid && s.selectedTxt]}>Avoid</Text>
        </Pressable>
      </View>
      {onCheckIn && (
        <View style={s.checkInRow}>
          <Pressable style={s.checkIn} onPress={onCheckIn} accessibilityRole="button" accessibilityLabel={`Check in at ${place.name}`}>
            <Ionicons name="add-circle-outline" size={16} color={colors.been} />
            <Text style={s.checkInTxt}>Check in</Text>
          </Pressable>
          {visitCount !== undefined && visitCount > 0 && (
            <Text style={s.visitCount}>Visited {visitCount}{visitCount === 1 ? " time" : " times"} · only you can see this</Text>
          )}
        </View>
      )}
      {onOpenDetail && (
        <Pressable style={s.detail} onPress={() => onOpenDetail(place.placeId)} accessibilityRole="button">
          <Text style={s.detailTxt}>See full details</Text>
        </Pressable>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  sheet: { position: "absolute", left: space.sm, right: space.sm, bottom: space.sm, backgroundColor: colors.surface,
    borderColor: colors.hair, borderWidth: 1, borderRadius: radius.lg, padding: space.md },
  grab: { width: 34, height: 4, borderRadius: 99, backgroundColor: colors.hair, alignSelf: "center", marginBottom: space.sm },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space.md },
  headText: { flex: 1 },
  name: { fontSize: 18, color: colors.ink, fontWeight: "700" },
  rate: { flexDirection: "row", alignItems: "center", gap: 3 },
  rateNum: { fontSize: 26, fontWeight: "800", color: colors.accentPress },
  meta: { color: colors.muted, marginTop: 2 },
  actions: { flexDirection: "row", gap: space.sm, marginTop: space.md },
  btn: { borderColor: colors.hair, borderWidth: 1, borderRadius: radius.md, paddingVertical: space.sm, paddingHorizontal: space.md },
  primary: { backgroundColor: colors.accent, borderColor: colors.accent },
  selected: { backgroundColor: "#FFE2A8", borderColor: colors.accentPress },
  primaryTxt: { color: colors.onAccent, fontWeight: "600" },
  btnTxt: { color: colors.ink, fontWeight: "600" },
  selectedTxt: { color: colors.onAccent },
  checkInRow: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.md, flexWrap: "wrap" },
  checkIn: { flexDirection: "row", alignItems: "center", gap: space.xs, borderColor: colors.hair, borderWidth: 1, borderRadius: radius.pill, paddingVertical: space.xs, paddingHorizontal: space.md },
  checkInTxt: { color: colors.ink, fontWeight: "700", fontSize: 13 },
  visitCount: { color: colors.muted, fontSize: 12, flexShrink: 1 },
  detail: { marginTop: space.sm, alignItems: "center", paddingVertical: space.xs },
  detailTxt: { color: colors.muted, fontWeight: "600", fontSize: 13 },
});
