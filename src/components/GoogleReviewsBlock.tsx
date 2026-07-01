import { useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { colors, radius, space } from "../theme";
import type { PlaceDetails } from "../api/placeDetails";
import { formatRating } from "../lib/formatRating";
import { translateGoogleReview } from "../api/googleReviewTranslation";

const ENGLISH_HINTS = new Set([
  "a", "about", "again", "all", "also", "and", "are", "at", "back", "best", "but", "came",
  "clean", "come", "delicious", "did", "food", "for", "fresh", "friendly", "from", "good",
  "great", "had", "highly", "i", "in", "is", "it", "its", "nice", "not", "of", "ordered",
  "out", "place", "really", "service", "so", "that", "the", "there", "this", "to", "very",
  "was", "we", "were", "will", "with", "would", "you",
]);

function shouldOfferTranslation(text: string): boolean {
  const words = text.toLowerCase().match(/[a-z']+/g) ?? [];
  if (words.length === 0) return false;

  const asciiLetters = (text.match(/[A-Za-z]/g) ?? []).length;
  const nonAsciiChars = (text.match(/[^\x00-\x7F]/g) ?? []).length;
  if (nonAsciiChars > asciiLetters * 0.15) return true;

  const englishHits = words.filter((word) => ENGLISH_HINTS.has(word.replace(/^'|'$/g, ""))).length;
  if (words.length <= 3) return englishHits === 0;
  return englishHits < 2;
}

function GoogleReviewCard({ review, index }: { review: PlaceDetails["reviews"][number]; index: number }) {
  const [translated, setTranslated] = useState<string | null>(null);
  const [showTranslated, setShowTranslated] = useState(false);
  const [loading, setLoading] = useState(false);
  const canTranslate = shouldOfferTranslation(review.text);

  async function toggleTranslation() {
    if (!canTranslate) return;
    if (showTranslated) {
      setShowTranslated(false);
      return;
    }
    if (translated) {
      setShowTranslated(true);
      return;
    }
    setLoading(true);
    const next = await translateGoogleReview(review.text);
    setLoading(false);
    if (next) {
      setTranslated(next);
      setShowTranslated(true);
    }
  }

  return (
    <View key={index} testID="google-review-card" style={s.review}>
      <View style={s.row}>
        <Text style={s.author}>{review.author || "Google reviewer"}</Text>
        {review.rating !== undefined && <Text style={s.rating}>{"★"} {formatRating(review.rating)}</Text>}
      </View>
      <Text style={s.time}>{review.relativeTime}</Text>
      <Text style={s.text}>{showTranslated && translated ? translated : review.text}</Text>
      {canTranslate && (
        <Pressable onPress={toggleTranslation} accessibilityRole="button" style={s.translateBtn}>
          <Text style={s.translateTxt}>{showTranslated ? "Original" : loading ? "Translating..." : "Translate"}</Text>
        </Pressable>
      )}
    </View>
  );
}

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
          <GoogleReviewCard key={i} review={r} index={i} />
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
  translateBtn: { alignSelf: "flex-start", paddingTop: space.xs },
  translateTxt: { fontSize: 13, color: colors.slate, fontWeight: "800" },
  empty: { fontSize: 14, color: colors.muted },
  attribution: { fontSize: 12, color: colors.slate, fontWeight: "600", marginTop: 2 },
});
