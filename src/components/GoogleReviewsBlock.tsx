import { View, Text, StyleSheet } from "react-native";
import { colors, radius, space } from "../theme";
import type { PlaceDetails } from "../api/placeDetails";

// Google content block. Slate world, always carries attribution, kept visually separate from
// the golden community block (this mirrors the legal boundary in docs/DESIGN.md). Reviews are
// shown live and never stored.
export function GoogleReviewsBlock({ details }: { details: PlaceDetails }) {
  return (
    <View style={s.block}>
      <Text style={s.heading}>From Google</Text>
      {details.reviews.length === 0 ? (
        <Text style={s.empty}>No Google reviews to show.</Text>
      ) : (
        details.reviews.map((r, i) => (
          <View key={i} testID="google-review-card" style={s.review}>
            <View style={s.row}>
              <Text style={s.author}>{r.author || "Google reviewer"}</Text>
              {r.rating !== undefined && <Text style={s.rating}>{"★"} {r.rating}</Text>}
            </View>
            <Text style={s.time}>{r.relativeTime}</Text>
            <Text style={s.text}>{r.text}</Text>
          </View>
        ))
      )}
      <Text style={s.attribution}>{details.attribution}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  block: { gap: space.sm },
  heading: { fontSize: 16, fontWeight: "800", color: colors.slate },
  review: { backgroundColor: colors.surface, borderColor: colors.hair, borderWidth: 1, borderLeftColor: colors.slate, borderLeftWidth: 3, borderRadius: radius.lg, padding: space.md, gap: 2 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  author: { fontSize: 15, fontWeight: "700", color: colors.ink },
  rating: { fontSize: 13, fontWeight: "600", color: colors.slate },
  time: { fontSize: 12, color: colors.muted },
  text: { fontSize: 14, color: colors.ink, lineHeight: 20, marginTop: 2 },
  empty: { fontSize: 14, color: colors.muted },
  attribution: { fontSize: 12, color: colors.slate, fontWeight: "600", marginTop: 2 },
});
