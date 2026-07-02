import { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { getPlaceDetails, type PlaceDetails } from "../../src/api/placeDetails";
import { getGrounded, type Grounded } from "../../src/api/grounding";
import {
  addPlaceTag,
  deleteCommunityReview,
  getCommunity,
  getCommunityPage,
  saveCommunityReview,
  upvoteReview,
  reportReview,
  reportReviewPhoto,
  type Community,
  type CommunityPageOptions,
  type ReviewDraft,
} from "../../src/api/community";
import { getPlaceGuides, guideBadgeLabel, type PlaceGuide } from "../../src/api/guides";
import { openStatus, openStatusLabel } from "../../src/domain/openStatus";
import { formatWeekHours, shortDayName } from "../../src/domain/openingHours";
import { moderateAndAttachReviewPhoto, type LocalReviewPhotoAsset } from "../../src/api/reviewPhotos";
import { PlacePhotos } from "../../src/components/PlacePhotos";
import { GoogleReviewsBlock } from "../../src/components/GoogleReviewsBlock";
import { GroundedBlock } from "../../src/components/GroundedBlock";
import { CommunityBlock } from "../../src/components/CommunityBlock";
import { formatRating } from "../../src/lib/formatRating";
import { colors, radius, space } from "../../src/theme";

const REVIEW_PAGE_SIZE = 20;
const DEFAULT_REVIEW_FILTERS: CommunityPageOptions = { search: "", sort: "newest", photosOnly: false };

function priceLabel(level?: string): string {
  switch (level) {
    case "PRICE_LEVEL_INEXPENSIVE": return "$";
    case "PRICE_LEVEL_MODERATE": return "$$";
    case "PRICE_LEVEL_EXPENSIVE": return "$$$";
    case "PRICE_LEVEL_VERY_EXPENSIVE": return "$$$$";
    default: return "";
  }
}

export default function PlaceDetail() {
  const insets = useSafeAreaInsets();
  const { placeId } = useLocalSearchParams<{ placeId: string }>();
  const [details, setDetails] = useState<PlaceDetails | null>(null);
  const [grounded, setGrounded] = useState<Grounded | null>(null);
  const [community, setCommunity] = useState<Community | null>(null);
  const [guide, setGuide] = useState<PlaceGuide | null>(null);
  const [reviewSource, setReviewSource] = useState<"hungr" | "google">("hungr");
  const [reviewFilters, setReviewFilters] = useState<CommunityPageOptions>(DEFAULT_REVIEW_FILTERS);
  const [communityHasMore, setCommunityHasMore] = useState(false);
  const [loadingMoreReviews, setLoadingMoreReviews] = useState(false);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [loading, setLoading] = useState(true);

  function loadCommunity() {
    if (!placeId) return;
    getCommunity(placeId).then((c) => {
      setCommunity(c);
      setCommunityHasMore(!!c.hasMore);
    }).catch(() => {});
  }

  async function loadFilteredCommunity(nextFilters: CommunityPageOptions, append = false) {
    if (!placeId || loadingReviews || loadingMoreReviews) return;
    const offset = append ? community?.reviews.length ?? 0 : 0;
    append ? setLoadingMoreReviews(true) : setLoadingReviews(true);
    try {
      const page = await getCommunityPage(placeId, { ...nextFilters, limit: REVIEW_PAGE_SIZE, offset });
      setCommunity((prev) => {
        const reviews = append ? [...(prev?.reviews ?? []), ...page.reviews] : page.reviews;
        const ratings = reviews
          .map((r) => r.rating)
          .filter((rating): rating is number => typeof rating === "number" && Number.isFinite(rating));
        return {
          reviews,
          tags: prev?.tags ?? [],
          ratingAverage: prev?.ratingAverage ?? (ratings.length ? Math.round((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) * 10) / 10 : null),
          ratingCount: prev?.ratingCount ?? ratings.length,
          hasMore: page.hasMore,
          nextOffset: page.nextOffset,
        };
      });
      setCommunityHasMore(page.hasMore);
    } catch {
      // Keep the current reviews visible if a filter request fails.
    } finally {
      append ? setLoadingMoreReviews(false) : setLoadingReviews(false);
    }
  }

  function handleReviewFiltersChange(nextFilters: CommunityPageOptions) {
    setReviewFilters(nextFilters);
    loadFilteredCommunity(nextFilters);
  }

  async function handleSaveReview(draft: ReviewDraft): Promise<string | false> {
    if (!placeId) return false;
    const saved = await saveCommunityReview(placeId, draft);
    if (saved) loadCommunity();
    return saved;
  }

  async function handleDeleteReview(id: string): Promise<boolean> {
    const deleted = await deleteCommunityReview(id);
    if (deleted) loadCommunity();
    return deleted;
  }

  async function handleAddTag(tag: string): Promise<boolean> {
    if (!placeId) return false;
    const saved = await addPlaceTag(placeId, tag);
    if (saved) loadCommunity();
    return saved;
  }

  async function handleUpvote(id: string, upvote: boolean): Promise<void> {
    try { await upvoteReview(id, upvote); loadCommunity(); } catch { /* ignore */ }
  }

  function handleReport(id: string): Promise<void> {
    return reportReview(id).catch(() => {});
  }

  function handleReportPhoto(id: string): Promise<void> {
    return reportReviewPhoto(id).catch(() => {});
  }

  async function pickReviewPhotos(): Promise<LocalReviewPhotoAsset[]> {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return [];
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: 4,
      quality: 0.82,
      base64: true,
    });
    if (result.canceled) return [];
    return result.assets.map((asset) => ({
      uri: asset.uri,
      fileName: asset.fileName,
      mimeType: asset.mimeType,
      base64: asset.base64,
      width: asset.width,
      height: asset.height,
    }));
  }

  async function attachReviewPhotos(reviewId: string, photos: LocalReviewPhotoAsset[]): Promise<void> {
    if (!placeId || photos.length === 0) return;
    const results = await Promise.all(photos.map((photo) => moderateAndAttachReviewPhoto(placeId, reviewId, photo)));
    const rejected = results.find((result) => !result.approved);
    if (rejected) throw new Error(rejected.reason ?? "Review posted, but the photos could not be attached.");
    loadCommunity();
  }

  function openProfile(userId: string) {
    router.push({ pathname: "/profile/[userId]", params: { userId } });
  }

  useEffect(() => {
    if (!placeId) return;
    let active = true;
    setLoading(true);
    getPlaceDetails(placeId)
      .then((d) => {
        if (!active) return;
        setDetails(d);
        // Disambiguate with the address so two places sharing a name (chains, common names)
        // do not get each other's grounded answer under a Google-attributed heading.
        if (d?.name) {
          const groundedQuery = d.address ? `${d.name}, ${d.address}` : d.name;
          getGrounded(groundedQuery).then((g) => { if (active) setGrounded(g); }).catch(() => {});
        }
      })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    getCommunity(placeId).then((c) => { if (active) setCommunity(c); }).catch(() => {});
    getPlaceGuides([placeId]).then((g) => { if (active) setGuide(g[placeId] ?? null); }).catch(() => {});
    return () => { active = false; };
  }, [placeId]);

  return (
    <View style={s.wrap}>
      {/* Solid header so the status bar / time never blends into the scrolling content. */}
      <View style={[s.header, { height: insets.top + 48 }]}>
        <Pressable style={[s.back, { top: insets.top + 4 }]} onPress={() => router.back()} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={[s.content, { paddingTop: insets.top + 60 }]}
        showsVerticalScrollIndicator
        scrollEventThrottle={200}
        onScroll={({ nativeEvent }) => {
          if (reviewSource !== "hungr" || !communityHasMore || loadingMoreReviews) return;
          const remaining = nativeEvent.contentSize.height - nativeEvent.layoutMeasurement.height - nativeEvent.contentOffset.y;
          if (remaining < 220) loadFilteredCommunity(reviewFilters, true);
        }}
      >
        {loading && !details ? (
          <ActivityIndicator color={colors.accentPress} style={{ marginTop: space.xxl }} />
        ) : (
          <>
            <Text style={s.name}>{details?.name ?? "Place"}</Text>
            <View style={s.metaRow}>
              {community?.ratingAverage !== null && community?.ratingAverage !== undefined && community.ratingCount > 0 && (
                <Text style={s.hungrMeta}>{"★"} hungr {formatRating(community.ratingAverage)} ({community.ratingCount})</Text>
              )}
              {details?.rating !== undefined && (
                <Text style={s.googleMeta}>{"★"} {formatRating(details.rating)}{details.userRatingCount ? ` (${details.userRatingCount})` : ""}</Text>
              )}
              {!!priceLabel(details?.priceLevel) && <Text style={s.meta}>{priceLabel(details?.priceLevel)}</Text>}
            </View>
            {guide && (
              <View style={s.guideChip}>
                <Ionicons name="ribbon" size={14} color={colors.ink} />
                <Text style={s.guideChipTxt}>{guideBadgeLabel(guide)}{guide.year ? ` (${guide.year})` : ""}</Text>
              </View>
            )}
            {details?.address && <Text style={s.address}>{details.address}</Text>}
            {details?.lat !== undefined && details?.lng !== undefined && (
              <Pressable
                onPress={() => router.push({
                  pathname: "/(tabs)/map",
                  params: { focusId: details.placeId, focusLat: String(details.lat), focusLng: String(details.lng), focusName: details.name },
                })}
                accessibilityRole="button"
              >
                <Text style={s.mapsLink}>Show location</Text>
              </Pressable>
            )}
            {(() => {
              const status = openStatus(details?.openNow, details?.nextCloseTime);
              const showRow = status !== "unknown" || details?.takeout || details?.dineIn || details?.delivery;
              if (!showRow) return null;
              return (
              <View style={s.svcRow}>
                {status !== "unknown" && (
                  <View style={[s.svcChip, status === "open" ? s.openChip : status === "closing-soon" ? s.soonChip : s.closedChip]}>
                    <Text style={[s.svcChipTxt, status === "open" ? s.openChipTxt : status === "closing-soon" ? s.soonChipTxt : s.closedChipTxt]}>{openStatusLabel(status)}</Text>
                  </View>
                )}
                {details?.dineIn && <View style={[s.svcChip, s.amberChip]}><Text style={s.amberChipTxt}>Dine-in</Text></View>}
                {details?.takeout && <View style={[s.svcChip, s.amberChip]}><Text style={s.amberChipTxt}>Takeout</Text></View>}
                {details?.delivery && <View style={[s.svcChip, s.amberChip]}><Text style={s.amberChipTxt}>Delivery</Text></View>}
              </View>
              );
            })()}
            {((details?.photos && details.photos.length > 0) || (community?.reviews ?? []).some((r) => r.photos?.length)) && (
              <PlacePhotos
                names={details?.photos ?? []}
                reviewPhotos={(community?.reviews ?? []).flatMap((r) => r.photos ?? [])}
              />
            )}
            {(() => {
              const week = formatWeekHours(details?.periods);
              if (week.length > 0) {
                const todayName = shortDayName(new Date().getDay());
                return (
                  <View style={s.hours}>
                    <Text style={s.hoursTitle}>Opening hours</Text>
                    {week.map((d) => {
                      const isToday = d.day === todayName;
                      return (
                        <View key={d.day} style={s.hoursRow}>
                          <Text style={[s.hoursDay, isToday && s.hoursToday]}>{d.day}</Text>
                          <Text style={[s.hoursVal, isToday && s.hoursToday]}>{d.hours}</Text>
                        </View>
                      );
                    })}
                  </View>
                );
              }
              if (details?.weekdayDescriptions && details.weekdayDescriptions.length > 0) {
                return (
                  <View style={s.hours}>
                    <Text style={s.hoursTitle}>Opening hours</Text>
                    {details.weekdayDescriptions.map((line) => (
                      <Text key={line} style={s.hoursLine}>{line}</Text>
                    ))}
                  </View>
                );
              }
              return null;
            })()}
            {grounded && <GroundedBlock grounded={grounded} />}
            <View style={s.reviewTabs}>
              <Pressable
                style={[s.tab, reviewSource === "hungr" && s.tabOn]}
                onPress={() => setReviewSource("hungr")}
                accessibilityRole="button"
              >
                <Text style={[s.tabTxt, reviewSource === "hungr" && s.tabTxtOn]}>hungr reviews</Text>
              </Pressable>
              <Pressable
                style={[s.tab, reviewSource === "google" && s.tabOn]}
                onPress={() => setReviewSource("google")}
                accessibilityRole="button"
              >
                <Text style={[s.tabTxt, reviewSource === "google" && s.tabTxtOn]}>Google reviews</Text>
              </Pressable>
            </View>
            {reviewSource === "hungr" ? (
              <CommunityBlock
                reviews={community?.reviews ?? []}
                tags={community?.tags ?? []}
                filters={reviewFilters}
                onFiltersChange={handleReviewFiltersChange}
                onSaveReview={handleSaveReview}
                onDeleteReview={handleDeleteReview}
                onAddTag={handleAddTag}
                onUpvote={handleUpvote}
                onReport={handleReport}
                onReportPhoto={handleReportPhoto}
                onOpenProfile={openProfile}
                onPickPhotos={pickReviewPhotos}
                onAttachPhotos={attachReviewPhotos}
                hasMore={communityHasMore}
                loadingMore={loadingMoreReviews || loadingReviews}
                onLoadMore={() => loadFilteredCommunity(reviewFilters, true)}
              />
            ) : (
              details && <GoogleReviewsBlock details={details} />
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.canvas },
  header: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 3, backgroundColor: colors.canvas, borderBottomColor: colors.hair, borderBottomWidth: 1 },
  back: { position: "absolute", left: space.md, zIndex: 4, width: 40, height: 40, borderRadius: 99, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderColor: colors.hair, borderWidth: 1 },
  content: { padding: space.lg, paddingTop: space.xxl + space.xl, gap: space.md },
  // Centered, with side margins clearing the floating back button so it reads as a title.
  name: { fontSize: 26, fontWeight: "800", color: colors.ink, textAlign: "center", marginHorizontal: 44 },
  metaRow: { flexDirection: "row", gap: space.md, justifyContent: "center", flexWrap: "wrap" },
  meta: { fontSize: 14, fontWeight: "600", color: colors.muted },
  hungrMeta: { fontSize: 14, fontWeight: "700", color: colors.accentPress },
  // Google rating in slate (the blue attribution colour), not muted grey.
  googleMeta: { fontSize: 14, fontWeight: "700", color: colors.slate },
  address: { fontSize: 14, color: colors.muted },
  guideChip: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#FFF8DF", borderColor: colors.accent, borderWidth: 1, borderRadius: 999, paddingHorizontal: space.md, paddingVertical: 6 },
  guideChipTxt: { fontSize: 13, fontWeight: "800", color: colors.ink },
  mapsLink: { fontSize: 14, fontWeight: "600", color: colors.slate, textDecorationLine: "underline" },
  svcRow: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  svcChip: { borderRadius: 999, paddingHorizontal: space.md, paddingVertical: 5, borderWidth: 1 },
  svcChipTxt: { fontSize: 13, fontWeight: "800" },
  openChip: { backgroundColor: "#E7F0E5", borderColor: colors.been },
  openChipTxt: { color: colors.been },
  closedChip: { backgroundColor: colors.surface, borderColor: colors.hair },
  closedChipTxt: { color: colors.muted },
  soonChip: { backgroundColor: "#FBE7D2", borderColor: "#C77700" },
  soonChipTxt: { color: "#A85C00" },
  amberChip: { backgroundColor: "#FFF8DF", borderColor: colors.accent },
  amberChipTxt: { fontSize: 13, fontWeight: "800", color: colors.accentPress },
  hours: { backgroundColor: colors.surface, borderColor: colors.hair, borderWidth: 1, borderRadius: radius.md, padding: space.md, gap: 3 },
  hoursTitle: { fontSize: 13, fontWeight: "800", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 2 },
  hoursLine: { fontSize: 14, color: colors.ink },
  hoursRow: { flexDirection: "row", justifyContent: "space-between", gap: space.md },
  hoursDay: { fontSize: 14, color: colors.muted, fontWeight: "600", width: 52 },
  hoursVal: { fontSize: 14, color: colors.ink, flex: 1, textAlign: "right" },
  hoursToday: { color: colors.ink, fontWeight: "800" },
  reviewTabs: { flexDirection: "row", gap: space.sm },
  tab: { flex: 1, minHeight: 40, borderRadius: 999, borderColor: colors.hair, borderWidth: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  tabOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  tabTxt: { color: colors.muted, fontWeight: "800", fontSize: 13 },
  tabTxtOn: { color: colors.onAccent },
});
