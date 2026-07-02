import { useState } from "react";
import { Image, View, Text, Pressable, StyleSheet, TextInput, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, space } from "../theme";
import type { CommunityPageOptions, CommunityReview, ReviewDraft, ReviewPhoto, ReviewSort } from "../api/community";
import type { LocalReviewPhotoAsset } from "../api/reviewPhotos";
import { UNSUPPORTED_REVIEW_PHOTO_MESSAGE, reviewPhotoFormatError } from "../domain/reviewPhotoFormats";
import { StarRatingInput } from "./StarRatingInput";
import { formatRating } from "../lib/formatRating";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const STATE_LABELS = { liked: "Liked", loved: "Loved", disliked: "Disliked" };

function stateChipStyle(state: CommunityReview["state"]) {
  if (state === "liked") return s.likedChip;
  if (state === "loved") return s.lovedChip;
  if (state === "disliked") return s.dislikedChip;
  return null;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

function photoAttachErrorMessage(error: unknown): string {
  const fallback = "Review posted, but the photos could not be attached.";
  const message = errorMessage(error, fallback).trim();
  if (!message || message === fallback) return fallback;
  // These already read as complete, user-facing sentences.
  if (
    message === UNSUPPORTED_REVIEW_PHOTO_MESSAGE
    || message.includes("Vision")
    || message.includes("moderation")
    || message.includes("GOOGLE_VISION_KEY")
  ) {
    return message;
  }
  // Surface the real cause instead of hiding it behind a generic string, so photo failures are
  // diagnosable in the field rather than silently collapsing to "could not be attached".
  return `Review posted, but the photo could not be attached: ${message}`;
}

// First party content. Golden world, the hungr moat. Kept visually separate from the Google
// (slate) blocks above.
export function CommunityBlock({
  reviews,
  tags,
  onSaveReview,
  onDeleteReview,
  onAddTag,
  onUpvote,
  onReport,
  onReportPhoto,
  onOpenProfile,
  onPickPhotos,
  onAttachPhotos,
  filters,
  onFiltersChange,
  hasMore,
  loadingMore,
  onLoadMore,
}: {
  reviews: CommunityReview[];
  tags: string[];
  onSaveReview?: (draft: ReviewDraft) => Promise<string | boolean | void> | string | boolean | void;
  onDeleteReview?: (id: string) => Promise<boolean | void> | boolean | void;
  onAddTag?: (tag: string) => Promise<boolean | void> | boolean | void;
  onUpvote?: (id: string, upvote: boolean) => Promise<void> | void;
  onReport?: (id: string) => Promise<void> | void;
  onReportPhoto?: (id: string) => Promise<void> | void;
  onOpenProfile?: (userId: string) => void;
  onPickPhotos?: () => Promise<LocalReviewPhotoAsset[]>;
  onAttachPhotos?: (reviewId: string, photos: LocalReviewPhotoAsset[]) => Promise<void> | void;
  filters?: CommunityPageOptions;
  onFiltersChange?: (filters: CommunityPageOptions) => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
}) {
  const [editing, setEditing] = useState<CommunityReview | null>(null);
  const [body, setBody] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [tag, setTag] = useState("");
  const [selectedPhotos, setSelectedPhotos] = useState<LocalReviewPhotoAsset[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reported, setReported] = useState<Set<string>>(new Set());
  const [reportedPhotos, setReportedPhotos] = useState<Set<string>>(new Set());

  function updateFilters(partial: CommunityPageOptions) {
    onFiltersChange?.({ ...(filters ?? {}), ...partial, offset: 0 });
  }

  async function report(id: string) {
    if (!onReport || reported.has(id)) return;
    setReported((prev) => new Set(prev).add(id)); // optimistic
    try { await onReport(id); } catch { /* keep it shown as reported */ }
  }

  async function reportPhoto(id: string) {
    if (!onReportPhoto || reportedPhotos.has(id)) return;
    setReportedPhotos((prev) => new Set(prev).add(id));
    try { await onReportPhoto(id); } catch { /* keep optimistic reported state */ }
  }

  function startEdit(review: CommunityReview) {
    setEditing(review);
    setBody(review.body);
    setRating(review.rating ?? null);
    setSelectedPhotos([]);
  }

  async function pickPhotos() {
    if (!onPickPhotos || saving) return;
    setError(null);
    try {
      const photos = await onPickPhotos();
      const supported = photos.filter((photo) => !reviewPhotoFormatError(photo)).slice(0, 4);
      setSelectedPhotos(supported);
      if (supported.length < photos.length) {
        setError(UNSUPPORTED_REVIEW_PHOTO_MESSAGE);
      }
    } catch {
      setError("Could not open photos. Try again.");
    }
  }

  async function submitReview() {
    if (!onSaveReview || saving) return;
    // A review must carry a rating; the button is disabled without one, this guards programmatic calls.
    if (rating == null) { setError("Add a star rating to post your review."); return; }
    setSaving(true);
    setError(null);
    let result: string | boolean | void;
    try {
      result = await onSaveReview({ id: editing?.id, body, rating });
      if (result === false) {
        setError("Could not save review. Try again.");
        return;
      }
    } catch {
      setError("Could not save review. Try again.");
      return;
    } finally {
      setSaving(false);
    }

    const reviewId = typeof result === "string" ? result : editing?.id;
    let photoAttachError: string | null = selectedPhotos.length > 0 && !reviewId
      ? "Review posted, but the photos could not be attached."
      : null;
    if (reviewId && selectedPhotos.length > 0 && onAttachPhotos) {
      setSaving(true);
      try {
        await onAttachPhotos(reviewId, selectedPhotos);
      } catch (err) {
        photoAttachError = photoAttachErrorMessage(err);
      } finally {
        setSaving(false);
      }
    }

    setEditing(null);
    setBody("");
    setRating(null);
    setSelectedPhotos([]);
    if (photoAttachError) setError(photoAttachError);
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
    <>
      <View style={s.block}>
      <Text style={s.heading}>Write a review</Text>
      {tags.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tags}>
          {tags.map((t) => (
            <View key={t} style={s.tag}>
              <Text style={s.tagTxt}>{t}</Text>
            </View>
          ))}
        </ScrollView>
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
          {onPickPhotos && (
            <View style={s.photoPickRow}>
              <Pressable style={s.photoPickBtn} onPress={pickPhotos} accessibilityRole="button">
                <Ionicons name="image-outline" size={17} color={colors.accentPress} />
                <Text style={s.photoPickTxt}>Add photo</Text>
              </Pressable>
              {selectedPhotos.length > 0 && (
                <Text style={s.selectedPhotoTxt}>{selectedPhotos.length} photo{selectedPhotos.length === 1 ? "" : "s"} selected</Text>
              )}
            </View>
          )}
          {selectedPhotos.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.selectedPhotoList}>
              {selectedPhotos.map((photo, index) => (
                <Image
                  key={`${photo.uri}-${index}`}
                  source={{ uri: photo.uri }}
                  style={s.selectedPhoto}
                  testID="selected-review-photo"
                  accessibilityLabel={`Selected photo ${index + 1}`}
                  accessibilityIgnoresInvertColors
                />
              ))}
            </ScrollView>
          )}
          {body.trim() !== "" && rating == null && (
            <Text style={s.ratingHint}>Add a star rating to post your review.</Text>
          )}
          <View style={s.composerActions}>
            {editing && (
              <Pressable
                style={s.cancel}
                onPress={() => { setEditing(null); setBody(""); setRating(null); setSelectedPhotos([]); }}
                accessibilityRole="button"
              >
                <Text style={s.cancelTxt}>Cancel</Text>
              </Pressable>
            )}
            <Pressable style={[s.post, (!body.trim() || rating == null || saving) && s.disabled]} onPress={submitReview} disabled={!body.trim() || rating == null || saving} accessibilityRole="button">
              <Text style={s.postTxt}>{editing ? "Save review" : "Post review"}</Text>
            </Pressable>
          </View>
        </View>
      )}
      {error && <Text style={s.error}>{error}</Text>}
      </View>

      <View style={s.block}>
      <Text style={s.heading}>Browse reviews</Text>
      {filters && onFiltersChange && (
        <View style={s.browse}>
          <TextInput
            style={s.searchInput}
            placeholder="Search hungr reviews"
            placeholderTextColor={colors.muted}
            value={filters.search ?? ""}
            onChangeText={(search) => updateFilters({ search })}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterChips}>
            {(["newest", "popular", "rating"] as ReviewSort[]).map((sort) => (
              <Pressable
                key={sort}
                onPress={() => updateFilters({ sort })}
                style={[s.filterChip, (filters.sort ?? "newest") === sort && s.filterChipOn]}
                accessibilityRole="button"
              >
                <Text style={[s.filterChipTxt, (filters.sort ?? "newest") === sort && s.filterChipTxtOn]}>
                  {sort === "newest" ? "Newest" : sort === "popular" ? "Popular" : "Top rated"}
                </Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => updateFilters({ photosOnly: !filters.photosOnly })}
              style={[s.filterChip, filters.photosOnly && s.filterChipOn]}
              accessibilityRole="button"
            >
              <Text style={[s.filterChipTxt, filters.photosOnly && s.filterChipTxtOn]}>With photos</Text>
            </Pressable>
          </ScrollView>
        </View>
      )}
      {reviews.length === 0 ? (
        <Text style={s.empty}>No community reviews yet. Be the first to add one.</Text>
      ) : (
        reviews.map((r) => {
          const author = r.isMine ? "You" : r.authorUsername ? `@${r.authorUsername}` : r.authorName ?? "Community";
          const canOpen = !r.isMine && !!r.userId && !!onOpenProfile;
          return (
            <View key={r.id} style={s.review}>
              <View style={s.reviewTop}>
                <Pressable disabled={!canOpen} onPress={() => canOpen && onOpenProfile!(r.userId!)} style={s.authorWrap} accessibilityRole={canOpen ? "button" : undefined}>
                  <Text style={[s.author, canOpen && s.authorLink]} numberOfLines={1}>{author}</Text>
                </Pressable>
                <Text style={s.time}>{formatDate(r.createdAt)}{r.edited ? " · edited" : ""}</Text>
              </View>
              <View style={s.reviewMeta}>
                {r.rating !== undefined && <Text style={s.rating}>{"★"} {formatRating(r.rating)}</Text>}
                {r.state && (
                  <View style={[s.stateChip, stateChipStyle(r.state)]}>
                    <Text style={s.stateChipTxt}>{STATE_LABELS[r.state]}</Text>
                  </View>
                )}
              </View>
              <Text style={s.text}>{r.body}</Text>
              {(r.photos ?? []).length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.reviewPhotos}>
                  {(r.photos ?? []).map((photo: ReviewPhoto) => (
                    <View key={photo.id} style={s.reviewPhotoWrap}>
                      <Image source={{ uri: photo.uri }} style={s.reviewPhoto} accessibilityIgnoresInvertColors />
                      {onReportPhoto && !r.isMine && (
                        <Pressable onPress={() => reportPhoto(photo.id)} style={s.photoReportBtn} accessibilityRole="button">
                          <Text style={s.photoReportTxt}>{reportedPhotos.has(photo.id) ? "Reported" : "Report photo"}</Text>
                        </Pressable>
                      )}
                    </View>
                  ))}
                </ScrollView>
              )}
              <View style={s.reviewActions}>
                {onUpvote && (
                  <Pressable onPress={() => onUpvote(r.id, !r.mineUpvoted)} style={s.voteBtn} accessibilityRole="button" accessibilityLabel={r.mineUpvoted ? "Remove upvote" : "Upvote review"}>
                    <Ionicons name={r.mineUpvoted ? "arrow-up-circle" : "arrow-up-circle-outline"} size={18} color={r.mineUpvoted ? colors.accentPress : colors.muted} />
                    <Text style={[s.voteTxt, r.mineUpvoted && s.voteTxtOn]}>{r.upvotes}</Text>
                  </Pressable>
                )}
                {r.isMine ? (
                  <>
                    <Pressable onPress={() => startEdit(r)} accessibilityRole="button" style={s.linkBtn}>
                      <Text style={s.linkTxt}>Edit</Text>
                    </Pressable>
                    {onDeleteReview && (
                      <Pressable onPress={() => deleteReview(r.id)} accessibilityRole="button" style={s.linkBtn}>
                        <Text style={s.deleteTxt}>Delete</Text>
                      </Pressable>
                    )}
                  </>
                ) : onReport ? (
                  <Pressable onPress={() => report(r.id)} accessibilityRole="button" style={s.linkBtn}>
                    <Text style={s.reportTxt}>{reported.has(r.id) ? "Reported" : "Report"}</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          );
        })
      )}
      {hasMore && onLoadMore && (
        <Pressable style={[s.loadMore, loadingMore && s.disabled]} onPress={onLoadMore} disabled={loadingMore} accessibilityRole="button">
          <Text style={s.loadMoreTxt}>{loadingMore ? "Loading..." : "Load more"}</Text>
        </Pressable>
      )}
      </View>
    </>
  );
}

const s = StyleSheet.create({
  block: { backgroundColor: colors.surface, borderColor: colors.hair, borderWidth: 1, borderLeftColor: colors.accent, borderLeftWidth: 3, borderRadius: radius.lg, padding: space.md, gap: space.sm },
  heading: { fontSize: 16, fontWeight: "800", color: colors.accentPress },
  browse: { gap: space.xs },
  searchInput: { minHeight: 40, borderColor: colors.hair, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, color: colors.ink, backgroundColor: colors.canvas },
  filterChips: { gap: space.xs, paddingRight: space.md },
  filterChip: { minHeight: 32, justifyContent: "center", borderRadius: radius.pill, borderColor: colors.hair, borderWidth: 1, paddingHorizontal: space.md, backgroundColor: colors.surface },
  filterChipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  filterChipTxt: { color: colors.muted, fontWeight: "800", fontSize: 12 },
  filterChipTxtOn: { color: colors.onAccent },
  tags: { gap: space.xs, paddingRight: space.md },
  tag: { backgroundColor: colors.canvas, borderColor: colors.accent, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 4 },
  tagTxt: { fontSize: 12, fontWeight: "600", color: colors.accentPress },
  tagRow: { flexDirection: "row", gap: space.sm, alignItems: "center" },
  tagInput: { flex: 1, minHeight: 40, borderColor: colors.hair, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, color: colors.ink, backgroundColor: colors.canvas },
  smallBtn: { minHeight: 40, justifyContent: "center", backgroundColor: colors.accent, borderRadius: radius.md, paddingHorizontal: space.md },
  smallBtnTxt: { color: colors.onAccent, fontWeight: "800", fontSize: 13 },
  composer: { gap: space.sm, paddingTop: space.xs },
  input: { minHeight: 84, borderColor: colors.hair, borderWidth: 1, borderRadius: radius.md, padding: space.md, color: colors.ink, textAlignVertical: "top", backgroundColor: colors.canvas },
  photoPickRow: { flexDirection: "row", alignItems: "center", gap: space.sm, flexWrap: "wrap" },
  photoPickBtn: { minHeight: 34, flexDirection: "row", alignItems: "center", gap: 5, borderColor: colors.hair, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: space.md, backgroundColor: colors.surface },
  photoPickTxt: { color: colors.accentPress, fontWeight: "800", fontSize: 13 },
  selectedPhotoTxt: { color: colors.muted, fontWeight: "700", fontSize: 12 },
  selectedPhotoList: { gap: space.sm, paddingRight: space.md },
  selectedPhoto: { width: 74, height: 74, borderRadius: radius.md, backgroundColor: colors.hair },
  ratingHint: { fontSize: 12, color: colors.muted, fontWeight: "700" },
  composerActions: { flexDirection: "row", justifyContent: "flex-end", gap: space.sm },
  cancel: { minHeight: 40, justifyContent: "center", paddingHorizontal: space.md },
  cancelTxt: { color: colors.muted, fontWeight: "700" },
  post: { minHeight: 40, justifyContent: "center", backgroundColor: colors.accent, borderRadius: radius.md, paddingHorizontal: space.md },
  postTxt: { color: colors.onAccent, fontWeight: "800" },
  disabled: { opacity: 0.45 },
  review: { gap: 2, paddingBottom: space.sm, borderBottomColor: colors.hair, borderBottomWidth: 1 },
  reviewTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space.md },
  authorWrap: { flexShrink: 1 },
  author: { fontSize: 13, fontWeight: "800", color: colors.ink },
  authorLink: { color: colors.accentPress },
  reviewMeta: { flexDirection: "row", alignItems: "center", gap: space.xs, flexWrap: "wrap" },
  rating: { fontSize: 13, fontWeight: "700", color: colors.accentPress },
  stateChip: { borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 3 },
  likedChip: { backgroundColor: "#E7F0E5" },
  lovedChip: { backgroundColor: "#FCE4EE" },
  dislikedChip: { backgroundColor: "#F6E0DA" },
  stateChipTxt: { fontSize: 12, fontWeight: "800", color: colors.ink },
  time: { fontSize: 12, color: colors.muted, fontWeight: "600" },
  text: { fontSize: 14, color: colors.ink, lineHeight: 20 },
  reviewPhotos: { gap: space.sm, paddingVertical: space.xs },
  reviewPhotoWrap: { gap: 4 },
  reviewPhoto: { width: 118, height: 90, borderRadius: radius.md, backgroundColor: colors.hair },
  photoReportBtn: { alignSelf: "flex-start" },
  photoReportTxt: { fontSize: 12, color: colors.muted, fontWeight: "700" },
  reviewActions: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.xs },
  voteBtn: { flexDirection: "row", alignItems: "center", gap: 3 },
  voteTxt: { fontSize: 13, fontWeight: "700", color: colors.muted },
  voteTxtOn: { color: colors.accentPress },
  linkBtn: { paddingVertical: 2 },
  linkTxt: { color: colors.slate, fontWeight: "700", fontSize: 13 },
  deleteTxt: { color: colors.avoid, fontWeight: "700", fontSize: 13 },
  reportTxt: { color: colors.muted, fontWeight: "700", fontSize: 13 },
  loadMore: { minHeight: 40, alignItems: "center", justifyContent: "center", borderColor: colors.hair, borderWidth: 1, borderRadius: radius.md },
  loadMoreTxt: { color: colors.accentPress, fontWeight: "800", fontSize: 13 },
  error: { color: colors.avoid, fontWeight: "700", fontSize: 13 },
  empty: { fontSize: 14, color: colors.muted },
});
