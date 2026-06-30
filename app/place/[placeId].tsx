import { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, Linking, StyleSheet, ActivityIndicator } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { getPlaceDetails, type PlaceDetails } from "../../src/api/placeDetails";
import { getGrounded, type Grounded } from "../../src/api/grounding";
import {
  addPlaceTag,
  deleteCommunityReview,
  getCommunity,
  saveCommunityReview,
  type CommunityReview,
  type ReviewDraft,
} from "../../src/api/community";
import { GoogleReviewsBlock } from "../../src/components/GoogleReviewsBlock";
import { GroundedBlock } from "../../src/components/GroundedBlock";
import { CommunityBlock } from "../../src/components/CommunityBlock";
import { colors, space } from "../../src/theme";

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
  const [community, setCommunity] = useState<{ reviews: CommunityReview[]; tags: string[] } | null>(null);
  const [loading, setLoading] = useState(true);

  function loadCommunity() {
    if (!placeId) return;
    getCommunity(placeId).then(setCommunity).catch(() => {});
  }

  async function handleSaveReview(draft: ReviewDraft): Promise<boolean> {
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
    return () => { active = false; };
  }, [placeId]);

  return (
    <View style={s.wrap}>
      <Pressable style={[s.back, { top: insets.top + space.xs }]} onPress={() => router.back()} accessibilityLabel="Back">
        <Ionicons name="chevron-back" size={22} color={colors.ink} />
      </Pressable>
      <ScrollView
        contentContainerStyle={[s.content, { paddingTop: insets.top + space.xxl }]}
        showsVerticalScrollIndicator
      >
        {loading && !details ? (
          <ActivityIndicator color={colors.accentPress} style={{ marginTop: space.xxl }} />
        ) : (
          <>
            <Text style={s.name}>{details?.name ?? "Place"}</Text>
            <View style={s.metaRow}>
              {details?.rating !== undefined && (
                <Text style={s.meta}>{"★"} {details.rating}{details.userRatingCount ? ` (${details.userRatingCount})` : ""}</Text>
              )}
              {!!priceLabel(details?.priceLevel) && <Text style={s.meta}>{priceLabel(details?.priceLevel)}</Text>}
            </View>
            {details?.address && <Text style={s.address}>{details.address}</Text>}
            {details?.googleMapsUri && (
              <Pressable onPress={() => Linking.openURL(details.googleMapsUri!)} accessibilityRole="link">
                <Text style={s.mapsLink}>View on Google Maps</Text>
              </Pressable>
            )}
            {details && <GoogleReviewsBlock details={details} />}
            {grounded && <GroundedBlock grounded={grounded} />}
            <CommunityBlock
              reviews={community?.reviews ?? []}
              tags={community?.tags ?? []}
              onSaveReview={handleSaveReview}
              onDeleteReview={handleDeleteReview}
              onAddTag={handleAddTag}
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.canvas },
  back: { position: "absolute", top: space.xxl, left: space.md, zIndex: 2, width: 40, height: 40, borderRadius: 99, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderColor: colors.hair, borderWidth: 1 },
  content: { padding: space.lg, paddingTop: space.xxl + space.xl, gap: space.md },
  name: { fontSize: 26, fontWeight: "800", color: colors.ink, marginLeft: 52 },
  metaRow: { flexDirection: "row", gap: space.md },
  meta: { fontSize: 14, fontWeight: "600", color: colors.muted },
  address: { fontSize: 14, color: colors.muted },
  mapsLink: { fontSize: 14, fontWeight: "600", color: colors.slate, textDecorationLine: "underline" },
});
