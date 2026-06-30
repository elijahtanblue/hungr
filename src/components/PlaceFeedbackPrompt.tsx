import { useState } from "react";
import { View, Text, Pressable, TextInput, StyleSheet } from "react-native";
import { colors, radius, space } from "../theme";
import { StarRatingInput } from "./StarRatingInput";

type FeedbackState = "been" | "avoid";

const avoidReasons = ["Not my taste", "Too expensive", "Bad food", "Poor service"];

export type FeedbackResult = { rating: number | null; reason: string | null; note: string };

export function PlaceFeedbackPrompt({
  placeName, state, onClose, onSubmit,
}: {
  placeName: string;
  state: FeedbackState;
  onClose: () => void;
  onSubmit?: (result: FeedbackResult) => void;
}) {
  const [rating, setRating] = useState<number | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const isBeen = state === "been";

  function done() {
    onSubmit?.({ rating, reason, note });
    onClose();
  }

  return (
    <View style={s.backdrop}>
      <View style={s.card}>
        <Text style={s.title}>{isBeen ? "How was the food?" : "Why avoid this spot?"}</Text>
        <Text style={s.place} numberOfLines={1}>{placeName}</Text>
        <StarRatingInput value={rating} onChange={setRating} />
        {isBeen ? (
          <>
            <TextInput
              style={s.input}
              placeholder="Leave a short review"
              placeholderTextColor={colors.muted}
              value={note}
              onChangeText={setNote}
              multiline
            />
            <Text style={s.prompt}>Be the first in your friend group to review this spot.</Text>
          </>
        ) : (
          <>
            <View style={s.reasonGrid}>
              {avoidReasons.map((r) => {
                const selected = reason === r;
                return (
                  <Pressable
                    key={r}
                    onPress={() => setReason(r)}
                    style={[s.reasonBtn, selected && s.choiceOn]}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                  >
                    <Text style={[s.choiceTxt, selected && s.choiceTxtOn]}>{r}</Text>
                  </Pressable>
                );
              })}
            </View>
            <TextInput
              style={s.input}
              placeholder="Leave a short review"
              placeholderTextColor={colors.muted}
              value={note}
              onChangeText={setNote}
              multiline
            />
          </>
        )}
        <View style={s.actions}>
          <Pressable style={s.skip} onPress={onClose} accessibilityRole="button">
            <Text style={s.skipTxt}>Skip</Text>
          </Pressable>
          <Pressable style={s.done} onPress={done} accessibilityRole="button">
            <Text style={s.doneTxt}>Post</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  backdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "flex-end", backgroundColor: "rgba(28,26,23,0.25)", padding: space.sm },
  card: { backgroundColor: colors.surface, borderColor: colors.hair, borderWidth: 1, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  title: { fontSize: 20, fontWeight: "800", color: colors.ink },
  place: { fontSize: 14, fontWeight: "600", color: colors.muted },
  reasonGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  reasonBtn: { borderColor: colors.hair, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: space.md, minHeight: 40, justifyContent: "center", backgroundColor: colors.surface },
  choiceOn: { backgroundColor: "#FFE2A8", borderColor: colors.accentPress },
  choiceTxt: { color: colors.ink, fontWeight: "700" },
  choiceTxtOn: { color: colors.onAccent },
  input: { minHeight: 72, borderColor: colors.hair, borderWidth: 1, borderRadius: radius.md, padding: space.md, color: colors.ink, textAlignVertical: "top", backgroundColor: colors.canvas },
  prompt: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: space.sm },
  skip: { minHeight: 44, borderRadius: radius.md, paddingHorizontal: space.md, justifyContent: "center" },
  skipTxt: { color: colors.muted, fontWeight: "700" },
  done: { minHeight: 44, borderRadius: radius.md, paddingHorizontal: space.lg, justifyContent: "center", backgroundColor: colors.accent },
  doneTxt: { color: colors.onAccent, fontWeight: "800" },
});
