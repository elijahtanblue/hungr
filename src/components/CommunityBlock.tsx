import { View, Text, StyleSheet } from "react-native";
import { colors, radius, space } from "../theme";
import type { CommunityReview } from "../api/community";

// First party content. Golden world, the hungr moat. Kept visually separate from the Google
// (slate) blocks above.
export function CommunityBlock({ reviews, tags }: { reviews: CommunityReview[]; tags: string[] }) {
  return (
    <View style={s.block}>
      <Text style={s.heading}>hungr community</Text>
      {tags.length > 0 && (
        <View style={s.tags}>
          {tags.map((t) => (
            <View key={t} style={s.tag}>
              <Text style={s.tagTxt}>{t}</Text>
            </View>
          ))}
        </View>
      )}
      {reviews.length === 0 ? (
        <Text style={s.empty}>No community reviews yet. Be the first to add one.</Text>
      ) : (
        reviews.map((r) => (
          <View key={r.id} style={s.review}>
            {r.rating !== undefined && <Text style={s.rating}>{"★"} {r.rating}</Text>}
            <Text style={s.text}>{r.body}</Text>
          </View>
        ))
      )}
    </View>
  );
}

const s = StyleSheet.create({
  block: { backgroundColor: colors.surface, borderColor: colors.hair, borderWidth: 1, borderLeftColor: colors.accent, borderLeftWidth: 3, borderRadius: radius.lg, padding: space.md, gap: space.sm },
  heading: { fontSize: 16, fontWeight: "800", color: colors.accentPress },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  tag: { backgroundColor: colors.canvas, borderColor: colors.accent, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 4 },
  tagTxt: { fontSize: 12, fontWeight: "600", color: colors.accentPress },
  review: { gap: 2, paddingBottom: space.sm, borderBottomColor: colors.hair, borderBottomWidth: 1 },
  rating: { fontSize: 13, fontWeight: "700", color: colors.accentPress },
  text: { fontSize: 14, color: colors.ink, lineHeight: 20 },
  empty: { fontSize: 14, color: colors.muted },
});
