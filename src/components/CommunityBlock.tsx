import { useState } from "react";
import { View, Text, Pressable, StyleSheet, TextInput } from "react-native";
import { colors, radius, space } from "../theme";
import type { CommunityReview, ReviewDraft } from "../api/community";
import { StarRatingInput } from "./StarRatingInput";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

// First party content. Golden world, the hungr moat. Kept visually separate from the Google
// (slate) blocks above.
export function CommunityBlock({
  reviews,
  tags,
  onSaveReview,
  onDeleteReview,
  onAddTag,
}: {
  reviews: CommunityReview[];
  tags: string[];
  onSaveReview?: (draft: ReviewDraft) => Promise<boolean | void> | boolean | void;
  onDeleteReview?: (id: string) => Promise<boolean | void> | boolean | void;
  onAddTag?: (tag: string) => Promise<boolean | void> | boolean | void;
}) {
  const [editing, setEditing] = useState<CommunityReview | null>(null);
  const [body, setBody] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [tag, setTag] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function startEdit(review: CommunityReview) {
    setEditing(review);
    setBody(review.body);
    setRating(review.rating ?? null);
  }

  async function submitReview() {
    if (!onSaveReview || saving) return;
    setSaving(true);
    setError(null);
    try {
      const result = await onSaveReview({ id: editing?.id, body, rating });
      if (result === false) {
        setError("Could not save review. Try again.");
        return;
      }
      setEditing(null);
      setBody("");
      setRating(null);
    } catch {
      setError("Could not save review. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function submitTag() {
    const next = tag.trim();
    if (!next || !onAddTag || saving) return;
    setSaving(true);
    setError(null);
    try {
      const result = await onAddTag(next);
      if (result === false) {
        setError("Could not add tag. Try again.");
        return;
      }
      setTag("");
    } catch {
      setError("Could not add tag. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteReview(id: string) {
    if (!onDeleteReview || saving) return;
    setSaving(true);
    setError(null);
    try {
      const result = await onDeleteReview(id);
      if (result === false) setError("Could not delete review. Try again.");
    } catch {
      setError("Could not delete review. Try again.");
    } finally {
      setSaving(false);
    }
  }

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
      {onAddTag && (
        <View style={s.tagRow}>
          <TextInput
            style={s.tagInput}
            placeholder="Add a tag"
            placeholderTextColor={colors.muted}
            value={tag}
            onChangeText={setTag}
            autoCapitalize="none"
          />
          <Pressable style={[s.smallBtn, (!tag.trim() || saving) && s.disabled]} onPress={submitTag} disabled={!tag.trim() || saving} accessibilityRole="button">
            <Text style={s.smallBtnTxt}>Add tag</Text>
          </Pressable>
        </View>
      )}
      {onSaveReview && (
        <View style={s.composer}>
          <StarRatingInput value={rating} onChange={setRating} />
          <TextInput
            style={s.input}
            placeholder="What should future you remember?"
            placeholderTextColor={colors.muted}
            value={body}
            onChangeText={setBody}
            multiline
          />
          <View style={s.composerActions}>
            {editing && (
              <Pressable
                style={s.cancel}
                onPress={() => { setEditing(null); setBody(""); setRating(null); }}
                accessibilityRole="button"
              >
                <Text style={s.cancelTxt}>Cancel</Text>
              </Pressable>
            )}
            <Pressable style={[s.post, (!body.trim() || saving) && s.disabled]} onPress={submitReview} disabled={!body.trim() || saving} accessibilityRole="button">
              <Text style={s.postTxt}>{editing ? "Save review" : "Post review"}</Text>
            </Pressable>
          </View>
        </View>
      )}
      {error && <Text style={s.error}>{error}</Text>}
      {reviews.length === 0 ? (
        <Text style={s.empty}>No community reviews yet. Be the first to add one.</Text>
      ) : (
        reviews.map((r) => (
          <View key={r.id} style={s.review}>
            <View style={s.reviewTop}>
              {r.rating !== undefined && <Text style={s.rating}>{"★"} {r.rating}</Text>}
              <Text style={s.time}>{formatDate(r.createdAt)}</Text>
            </View>
            <Text style={s.text}>{r.body}</Text>
            {r.isMine && (
              <View style={s.reviewActions}>
                <Pressable onPress={() => startEdit(r)} accessibilityRole="button" style={s.linkBtn}>
                  <Text style={s.linkTxt}>Edit</Text>
                </Pressable>
                {onDeleteReview && (
                  <Pressable onPress={() => deleteReview(r.id)} accessibilityRole="button" style={s.linkBtn}>
                    <Text style={s.deleteTxt}>Delete</Text>
                  </Pressable>
                )}
              </View>
            )}
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
  tagRow: { flexDirection: "row", gap: space.sm, alignItems: "center" },
  tagInput: { flex: 1, minHeight: 40, borderColor: colors.hair, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, color: colors.ink, backgroundColor: colors.canvas },
  smallBtn: { minHeight: 40, justifyContent: "center", backgroundColor: colors.accent, borderRadius: radius.md, paddingHorizontal: space.md },
  smallBtnTxt: { color: colors.onAccent, fontWeight: "800", fontSize: 13 },
  composer: { gap: space.sm, paddingTop: space.xs },
  input: { minHeight: 84, borderColor: colors.hair, borderWidth: 1, borderRadius: radius.md, padding: space.md, color: colors.ink, textAlignVertical: "top", backgroundColor: colors.canvas },
  composerActions: { flexDirection: "row", justifyContent: "flex-end", gap: space.sm },
  cancel: { minHeight: 40, justifyContent: "center", paddingHorizontal: space.md },
  cancelTxt: { color: colors.muted, fontWeight: "700" },
  post: { minHeight: 40, justifyContent: "center", backgroundColor: colors.accent, borderRadius: radius.md, paddingHorizontal: space.md },
  postTxt: { color: colors.onAccent, fontWeight: "800" },
  disabled: { opacity: 0.45 },
  review: { gap: 2, paddingBottom: space.sm, borderBottomColor: colors.hair, borderBottomWidth: 1 },
  reviewTop: { flexDirection: "row", justifyContent: "space-between", gap: space.md },
  rating: { fontSize: 13, fontWeight: "700", color: colors.accentPress },
  time: { fontSize: 12, color: colors.muted, fontWeight: "600" },
  text: { fontSize: 14, color: colors.ink, lineHeight: 20 },
  reviewActions: { flexDirection: "row", gap: space.md, marginTop: space.xs },
  linkBtn: { paddingVertical: 2 },
  linkTxt: { color: colors.slate, fontWeight: "700", fontSize: 13 },
  deleteTxt: { color: colors.avoid, fontWeight: "700", fontSize: 13 },
  error: { color: colors.avoid, fontWeight: "700", fontSize: 13 },
  empty: { fontSize: 14, color: colors.muted },
});
