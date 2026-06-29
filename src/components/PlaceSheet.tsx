import { View, Text, Pressable, StyleSheet } from "react-native";
import { colors, radius, space } from "../theme";
import type { Place, PlaceState } from "../domain/types";

export function PlaceSheet({
  place, onSetState, onOpenDetail,
}: {
  place: Place;
  onSetState: (placeId: string, state: PlaceState) => void;
  onOpenDetail?: (placeId: string) => void;
}) {
  return (
    <View style={s.sheet}>
      <View style={s.grab} />
      <View style={s.row}>
        <Text style={s.name}>{place.name}</Text>
        {place.rating !== undefined && <Text style={s.rate}>{"★"} {place.rating}</Text>}
      </View>
      <Text style={s.meta}>{place.cuisines.join(" · ")}</Text>
      <View style={s.actions}>
        <Pressable style={[s.btn, s.primary]} onPress={() => onSetState(place.placeId, "go")} accessibilityRole="button" accessibilityLabel={`Mark ${place.name} as want to go`}>
          <Text style={s.primaryTxt}>Want to go</Text>
        </Pressable>
        <Pressable style={s.btn} onPress={() => onSetState(place.placeId, "been")} accessibilityRole="button" accessibilityLabel={`Mark ${place.name} as been`}>
          <Text style={s.btnTxt}>Been</Text>
        </Pressable>
        <Pressable style={s.btn} onPress={() => onSetState(place.placeId, "avoid")} accessibilityRole="button" accessibilityLabel={`Mark ${place.name} as avoid`}>
          <Text style={s.btnTxt}>Avoid</Text>
        </Pressable>
      </View>
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
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: { fontSize: 18, color: colors.ink, fontWeight: "700" },
  rate: { color: colors.accentPress, fontWeight: "600" },
  meta: { color: colors.muted, marginTop: 2 },
  actions: { flexDirection: "row", gap: space.sm, marginTop: space.md },
  btn: { borderColor: colors.hair, borderWidth: 1, borderRadius: radius.md, paddingVertical: space.sm, paddingHorizontal: space.md },
  primary: { backgroundColor: colors.accent, borderColor: colors.accent },
  primaryTxt: { color: colors.onAccent, fontWeight: "600" },
  btnTxt: { color: colors.ink, fontWeight: "600" },
  detail: { marginTop: space.sm, alignItems: "center", paddingVertical: space.xs },
  detailTxt: { color: colors.muted, fontWeight: "600", fontSize: 13 },
});
