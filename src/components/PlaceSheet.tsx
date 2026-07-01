import { useEffect, useRef } from "react";
import { Animated, View, Text, Image, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, space } from "../theme";
import type { Place, PlaceState } from "../domain/types";
import { formatRating } from "../lib/formatRating";
import { openStatus, openStatusLabel } from "../domain/openStatus";
import { todaysHours } from "../domain/openingHours";
import type { OpeningPeriod } from "../api/placeDetails";

export type CardReview = { body: string; rating: number | null };

function priceLabel(level?: string): string {
  switch (level) {
    case "PRICE_LEVEL_INEXPENSIVE": return "$";
    case "PRICE_LEVEL_MODERATE": return "$$";
    case "PRICE_LEVEL_EXPENSIVE": return "$$$";
    case "PRICE_LEVEL_VERY_EXPENSIVE": return "$$$$";
    default: return "";
  }
}

export function PlaceSheet({
  place, onSetState, onOpenDetail, visitCount, checkedInRecently = false, onCheckIn, photoUri, myReview, address,
  openNow, nextCloseTime, weekdayDescriptions, periods, takeout, dineIn, delivery,
}: {
  place: Place;
  onSetState: (placeId: string, state: PlaceState) => void;
  onOpenDetail?: (placeId: string) => void;
  visitCount?: number;
  checkedInRecently?: boolean;
  onCheckIn?: () => void;
  photoUri?: string | null;
  myReview?: CardReview | null;
  address?: string | null;
  openNow?: boolean;
  nextCloseTime?: string;
  weekdayDescriptions?: string[];
  periods?: OpeningPeriod[];
  takeout?: boolean;
  dineIn?: boolean;
  delivery?: boolean;
}) {
  const checkScale = useRef(new Animated.Value(1)).current;
  const isGo = place.state === "go";
  const isLiked = place.state === "liked";
  const isLoved = place.state === "loved";
  const isDisliked = place.state === "disliked";
  const openingHoursPreview = weekdayDescriptions?.find((line) => line.trim());
  const price = priceLabel(place.priceLevel);
  const today = todaysHours(periods);
  const status = openStatus(openNow, nextCloseTime);

  useEffect(() => {
    if (!checkedInRecently) return;
    Animated.sequence([
      Animated.timing(checkScale, { toValue: 1.08, duration: 120, useNativeDriver: true }),
      Animated.spring(checkScale, { toValue: 1, friction: 5, tension: 90, useNativeDriver: true }),
    ]).start();
  }, [checkedInRecently, checkScale]);

  return (
    <View style={s.sheet}>
      <View style={s.grab} />
      {photoUri && (
        <Image source={{ uri: photoUri }} style={s.photo} accessibilityIgnoresInvertColors accessibilityLabel={`Photo of ${place.name}`} />
      )}
      <View style={s.row}>
        <View style={s.headText}>
          <Text style={s.name}>{place.name}</Text>
          {(place.cuisines.length > 0 || price) && (
            <Text style={s.meta}>
              {place.cuisines.join(" · ")}
              {place.cuisines.length > 0 && price ? "  ·  " : ""}
              {!!price && <Text style={s.price}>{price}</Text>}
            </Text>
          )}
          {!!address && <Text style={s.cardAddress} numberOfLines={1}>{address}</Text>}
        </View>
        {place.rating !== undefined && (
          <View style={s.rate}>
            <Ionicons name="star" size={18} color={colors.accentPress} />
            <Text style={s.rateNum}>{formatRating(place.rating)}</Text>
          </View>
        )}
      </View>
      {(status !== "unknown" || takeout || dineIn || delivery) && (
        <View style={s.chips}>
          {status !== "unknown" && (
            <View style={[s.chip, status === "open" ? s.openChip : status === "closing-soon" ? s.soonChip : s.closedChip]}>
              <Text style={[s.chipTxt, status === "open" ? s.openChipTxt : status === "closing-soon" ? s.soonChipTxt : s.closedChipTxt]}>{openStatusLabel(status)}</Text>
            </View>
          )}
          {dineIn && <View style={[s.chip, s.svcChip]}><Text style={s.svcChipTxt}>Dine-in</Text></View>}
          {takeout && <View style={[s.chip, s.svcChip]}><Text style={s.svcChipTxt}>Takeout</Text></View>}
          {delivery && <View style={[s.chip, s.svcChip]}><Text style={s.svcChipTxt}>Delivery</Text></View>}
        </View>
      )}
      {(today || openingHoursPreview) && (
        <View style={s.hoursPreview}>
          <Text style={s.hoursLabel}>{today ? "Hours today" : "Opening hours"}</Text>
          <Text style={s.hoursText} numberOfLines={1}>{today ?? openingHoursPreview}</Text>
        </View>
      )}
      <View style={s.actions}>
        <Pressable style={[s.btn, !place.state && s.primary, isGo && s.selected]} onPress={() => onSetState(place.placeId, "go")} accessibilityRole="button" accessibilityLabel={`Mark ${place.name} as want to go`}>
          <Text style={[s.btnTxt, !place.state && s.primaryTxt, isGo && s.selectedTxt]}>{isGo ? "Saved" : "Want to go"}</Text>
        </Pressable>
        <Pressable style={[s.btn, isLiked && s.likedOn]} onPress={() => onSetState(place.placeId, "liked")} accessibilityRole="button" accessibilityLabel={`Mark ${place.name} as liked`}>
          <Text style={[s.btnTxt, isLiked && s.likedTxt]}>Liked</Text>
        </Pressable>
        <Pressable style={[s.btn, isLoved && s.lovedOn]} onPress={() => onSetState(place.placeId, "loved")} accessibilityRole="button" accessibilityLabel={`Mark ${place.name} as loved`}>
          <Text style={[s.btnTxt, isLoved && s.lovedTxt]}>Loved</Text>
        </Pressable>
        <Pressable style={[s.btn, isDisliked && s.dislikedOn]} onPress={() => onSetState(place.placeId, "disliked")} accessibilityRole="button" accessibilityLabel={`Mark ${place.name} as disliked`}>
          <Text style={[s.btnTxt, isDisliked && s.dislikedTxt]}>Disliked</Text>
        </Pressable>
      </View>
      {onCheckIn && (
        <View style={s.checkInRow}>
          <Animated.View style={{ transform: [{ scale: checkScale }] }}>
            <Pressable
              style={[s.checkIn, checkedInRecently && s.checkInOn]}
              onPress={onCheckIn}
              accessibilityRole="button"
              accessibilityLabel={`Check in at ${place.name}`}
            >
              <Ionicons
                name={checkedInRecently ? "checkmark-circle" : "add-circle-outline"}
                size={16}
                color={checkedInRecently ? colors.been : colors.been}
              />
              <Text style={[s.checkInTxt, checkedInRecently && s.checkInTxtOn]}>
                {checkedInRecently ? "Checked in" : "Check in"}
              </Text>
            </Pressable>
          </Animated.View>
          {checkedInRecently && <Text style={s.checkedTxt}>You've checked in</Text>}
          {visitCount !== undefined && visitCount > 0 && (
            <Text style={s.visitCount}>Visited {visitCount}{visitCount === 1 ? " time" : " times"} · only you can see this</Text>
          )}
        </View>
      )}
      {myReview && (
        <Pressable
          style={s.myReview}
          onPress={() => onOpenDetail?.(place.placeId)}
          accessibilityRole="button"
          accessibilityLabel="See your review"
        >
          <View style={s.myReviewHead}>
            <Text style={s.myReviewLabel}>Your review</Text>
            {myReview.rating !== null && <Text style={s.myReviewRating}>{"★"} {formatRating(myReview.rating)}</Text>}
          </View>
          {!!myReview.body && <Text style={s.myReviewBody} numberOfLines={2}>{myReview.body}</Text>}
        </Pressable>
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
  photo: { width: "100%", height: 132, borderRadius: radius.md, marginBottom: space.sm, backgroundColor: colors.hair },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space.md },
  headText: { flex: 1 },
  name: { fontSize: 18, color: colors.ink, fontWeight: "700" },
  rate: { flexDirection: "row", alignItems: "center", gap: 3 },
  rateNum: { fontSize: 26, fontWeight: "800", color: colors.accentPress },
  meta: { color: colors.muted, marginTop: 2 },
  price: { color: colors.ink, fontWeight: "800" },
  cardAddress: { color: colors.muted, fontSize: 13, marginTop: 2 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.xs, marginTop: space.sm },
  chip: { borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 4, borderWidth: 1 },
  chipTxt: { fontSize: 12, fontWeight: "800" },
  openChip: { backgroundColor: "#E7F0E5", borderColor: colors.been },
  openChipTxt: { color: colors.been },
  closedChip: { backgroundColor: colors.canvas, borderColor: colors.hair },
  closedChipTxt: { color: colors.muted },
  soonChip: { backgroundColor: "#FBE7D2", borderColor: "#C77700" },
  soonChipTxt: { color: "#A85C00" },
  // Amber when the service is available, matching the "glowing amber if available" request.
  svcChip: { backgroundColor: "#FFF8DF", borderColor: colors.accent },
  svcChipTxt: { fontSize: 12, fontWeight: "800", color: colors.accentPress },
  hoursPreview: { marginTop: space.sm, gap: 2 },
  hoursLabel: { fontSize: 11, fontWeight: "800", color: colors.muted, textTransform: "uppercase" },
  hoursText: { fontSize: 13, color: colors.ink },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.md },
  btn: { flexGrow: 1, flexBasis: "46%", alignItems: "center", borderColor: colors.hair, borderWidth: 1, borderRadius: radius.md, paddingVertical: space.sm, paddingHorizontal: space.md },
  primary: { backgroundColor: colors.accent, borderColor: colors.accent },
  selected: { backgroundColor: "#FFE2A8", borderColor: colors.accentPress },
  likedOn: { backgroundColor: "#E7F0E5", borderColor: colors.been },
  lovedOn: { backgroundColor: "#FCE4EE", borderColor: colors.loved },
  dislikedOn: { backgroundColor: "#F6E0DA", borderColor: colors.avoid },
  primaryTxt: { color: colors.onAccent, fontWeight: "600" },
  btnTxt: { color: colors.ink, fontWeight: "600" },
  selectedTxt: { color: colors.onAccent },
  likedTxt: { color: colors.been, fontWeight: "800" },
  lovedTxt: { color: colors.loved, fontWeight: "800" },
  dislikedTxt: { color: colors.avoid, fontWeight: "800" },
  checkInRow: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.md, flexWrap: "wrap" },
  checkIn: { flexDirection: "row", alignItems: "center", gap: space.xs, borderColor: colors.hair, borderWidth: 1, borderRadius: radius.pill, paddingVertical: space.xs, paddingHorizontal: space.md },
  checkInOn: { backgroundColor: "#EAF3E7", borderColor: colors.been },
  checkInTxt: { color: colors.ink, fontWeight: "700", fontSize: 13 },
  checkInTxtOn: { color: colors.been },
  checkedTxt: { color: colors.been, fontSize: 12, fontWeight: "800" },
  visitCount: { color: colors.muted, fontSize: 12, flexShrink: 1 },
  myReview: { marginTop: space.md, backgroundColor: colors.canvas, borderColor: colors.hair, borderWidth: 1, borderRadius: radius.md, padding: space.sm, gap: 3 },
  myReviewHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  myReviewLabel: { fontSize: 12, fontWeight: "800", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.4 },
  myReviewRating: { fontSize: 13, fontWeight: "800", color: colors.accentPress },
  myReviewBody: { fontSize: 14, color: colors.ink, lineHeight: 19 },
  detail: { marginTop: space.sm, alignItems: "center", paddingVertical: space.xs },
  detailTxt: { color: colors.muted, fontWeight: "600", fontSize: 13 },
});
