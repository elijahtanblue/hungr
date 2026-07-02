import { useCallback, useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, Image, StyleSheet } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../src/lib/supabase";
import { getMyProfile, getSocialCounts, type SocialCounts } from "../../src/api/social";
import { getMyReviews, type MyReview } from "../../src/api/community";
import { getMyPlaces, type MyPlaces as MyPlacesGroups } from "../../src/api/myPlaces";
import { getNotifications } from "../../src/api/notifications";
import { getMyTraits, type Trait } from "../../src/api/tasteTracking";
import { formatRating } from "../../src/lib/formatRating";
import type { PlaceState } from "../../src/domain/types";
import { colors, radius, space } from "../../src/theme";

const STATE_LABELS = { liked: "Liked", loved: "Loved", disliked: "Disliked" };
const emptyGroups: MyPlacesGroups = { go: [], liked: [], loved: [], disliked: [] };
const SAVED_TABS: { state: PlaceState; label: string; color: string }[] = [
  { state: "go", label: "Want to go", color: colors.accentPress },
  { state: "liked", label: "Liked", color: colors.been },
  { state: "loved", label: "Loved", color: colors.loved },
  { state: "disliked", label: "Disliked", color: colors.avoid },
];

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={s.stat}>
      <Text style={s.statNum}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function stateChipStyle(state: Exclude<PlaceState, "go">) {
  if (state === "liked") return s.likedChip;
  if (state === "loved") return s.lovedChip;
  return s.dislikedChip;
}

export default function Account() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState<string | null>(null);
  const [handle, setHandle] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [bio, setBio] = useState<string | null>(null);
  const [counts, setCounts] = useState<SocialCounts>({ followers: 0, following: 0, friends: 0 });
  const [reviews, setReviews] = useState<MyReview[]>([]);
  const [saved, setSaved] = useState<MyPlacesGroups>(emptyGroups);
  const [unread, setUnread] = useState(0);
  const [traits, setTraits] = useState<Trait[]>([]);
  const [openTrait, setOpenTrait] = useState<string | null>(null);
  // Hidden toggle: the profile shows either the user's reviews or their saved places.
  const [view, setView] = useState<"reviews" | "saved">("reviews");
  const [savedTab, setSavedTab] = useState<PlaceState>("go");

  useFocusEffect(
    useCallback(() => {
      supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
      getMyProfile().then((p) => { setHandle(p?.username ?? null); setAvatarUrl(p?.avatarUrl ?? null); setBio(p?.bio ?? null); }).catch(() => {});
      getSocialCounts().then(setCounts).catch(() => {});
      getMyReviews().then(setReviews).catch(() => {});
      getMyPlaces().then(setSaved).catch(() => {});
      getNotifications().then((n) => setUnread(n.filter((x) => !x.read).length)).catch(() => {});
      getMyTraits().then(setTraits).catch(() => {});
    }, []),
  );

  const savedRows = useMemo(() => saved[savedTab], [saved, savedTab]);

  return (
    <View testID="account-screen" style={s.wrap}>
      <View style={[s.topBar, { paddingTop: insets.top + space.sm }]}>
        <Pressable onPress={() => router.push("/notifications")} style={s.iconBtn} accessibilityRole="button" accessibilityLabel="Notifications">
          <Ionicons name="notifications-outline" size={22} color={colors.ink} />
          {unread > 0 && <View style={s.badge}><Text style={s.badgeTxt}>{unread > 9 ? "9+" : unread}</Text></View>}
        </Pressable>
        <Pressable onPress={() => router.push("/settings")} style={s.iconBtn} accessibilityRole="button" accessibilityLabel="Settings">
          <Ionicons name="settings-outline" size={22} color={colors.ink} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={s.avatar} />
        ) : (
          <View style={[s.avatar, s.avatarEmpty]}>
            <Ionicons name="person" size={34} color={colors.accentPress} />
          </View>
        )}
        <View style={s.handleRow}>
          <Pressable
            onPress={() => router.push("/titles-guide")}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="How titles work"
          >
            <Ionicons name="help-circle-outline" size={20} color={colors.muted} />
          </Pressable>
          <Text style={s.handle}>{handle ? `@${handle}` : "Set your handle in settings"}</Text>
        </View>
        {email && <Text style={s.email}>{email}</Text>}
        {!!bio && <Text style={s.bio}>{bio}</Text>}

        <View style={s.stats}>
          <Stat label="Reviews" value={reviews.length} />
          <Stat label="Followers" value={counts.followers} />
          <Stat label="Friends" value={counts.friends} />
        </View>

        {traits.length > 0 && (
          <View style={s.traits}>
            <View style={s.traitBubbles}>
              {traits.map((t) => {
                const on = openTrait === t.id;
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => setOpenTrait(on ? null : t.id)}
                    style={[s.traitBubble, on && s.traitBubbleOn]}
                    accessibilityRole="button"
                    accessibilityLabel={`${t.name} trait. Tap to see how you got it.`}
                  >
                    <Text style={s.traitEmoji}>{t.emoji}</Text>
                    <Text style={s.traitName}>{t.name}</Text>
                  </Pressable>
                );
              })}
            </View>
            {openTrait && (
              <Text style={s.traitDetail}>{traits.find((t) => t.id === openTrait)?.detail}</Text>
            )}
          </View>
        )}

        <Pressable style={s.actionRow} onPress={() => router.push("/tiktok-import")} accessibilityRole="button">
          <Ionicons name="logo-tiktok" size={20} color={colors.accentPress} />
          <View style={s.actionText}>
            <Text style={s.actionTitle}>Save from TikTok</Text>
            <Text style={s.actionHelp}>Paste a food video and confirm the right place before saving.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>

        <View style={s.viewToggle}>
          <Pressable
            style={[s.viewBtn, view === "reviews" && s.viewBtnOn]}
            onPress={() => setView("reviews")}
            accessibilityRole="button"
            accessibilityState={{ selected: view === "reviews" }}
          >
            <Ionicons name="star-outline" size={15} color={view === "reviews" ? colors.onAccent : colors.muted} />
            <Text style={[s.viewTxt, view === "reviews" && s.viewTxtOn]}>Reviews</Text>
          </Pressable>
          <Pressable
            style={[s.viewBtn, view === "saved" && s.viewBtnOn]}
            onPress={() => setView("saved")}
            accessibilityRole="button"
            accessibilityState={{ selected: view === "saved" }}
          >
            <Ionicons name="bookmark-outline" size={15} color={view === "saved" ? colors.onAccent : colors.muted} />
            <Text style={[s.viewTxt, view === "saved" && s.viewTxtOn]}>Saved</Text>
          </Pressable>
        </View>

        {view === "reviews" ? (
          reviews.length === 0 ? (
            <Text style={s.empty}>You haven't reviewed anywhere yet. Mark a spot Liked or Loved and leave a quick note.</Text>
          ) : (
            reviews.map((r) => (
              <Pressable
                key={r.id}
                style={s.review}
                onPress={() => router.push({ pathname: "/place/[placeId]", params: { placeId: r.placeId } })}
                accessibilityRole="button"
              >
                <View style={s.reviewHead}>
                  <Text style={s.reviewPlace} numberOfLines={1}>{r.placeName}</Text>
                  {r.placeRating !== null && <Text style={s.reviewRating}>{"★"} {formatRating(r.placeRating)}</Text>}
                </View>
                {r.state && <Text style={[s.reviewState, stateChipStyle(r.state)]}>{STATE_LABELS[r.state]}</Text>}
                {!!r.body && <Text style={s.reviewBody} numberOfLines={3}>{r.body}</Text>}
              </Pressable>
            ))
          )
        ) : (
          <>
            <View style={s.savedTabs}>
              {SAVED_TABS.map((t) => {
                const on = savedTab === t.state;
                return (
                  <Pressable key={t.state} onPress={() => setSavedTab(t.state)} style={[s.savedTab, on && { backgroundColor: t.color, borderColor: t.color }]} accessibilityRole="button">
                    <Text style={[s.savedTabTxt, on && s.savedTabTxtOn]}>{t.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            {savedRows.length === 0 ? (
              <Text style={s.empty}>Nothing here yet.</Text>
            ) : (
              savedRows.map((p) => (
                <Pressable
                  key={p.placeId}
                  style={s.review}
                  onPress={() => router.push({ pathname: "/place/[placeId]", params: { placeId: p.placeId } })}
                  accessibilityRole="button"
                >
                  <View style={s.reviewHead}>
                    <Text style={s.reviewPlace} numberOfLines={1}>{p.name}</Text>
                    {p.placeRating !== null && <Text style={s.reviewRating}>{"★"} {formatRating(p.placeRating)}</Text>}
                  </View>
                  {!!(p.note || p.avoidReason) && <Text style={s.reviewBody} numberOfLines={2}>{p.note || p.avoidReason}</Text>}
                </Pressable>
              ))
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.canvas },
  topBar: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: space.xs, paddingHorizontal: space.lg, paddingBottom: space.xs },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  badge: { position: "absolute", top: 4, right: 4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: colors.avoid, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  badgeTxt: { color: "#fff", fontSize: 10, fontWeight: "800" },
  content: { padding: space.xl, alignItems: "center", paddingBottom: space.xxl },
  avatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.surface },
  avatarEmpty: { alignItems: "center", justifyContent: "center", borderColor: colors.hair, borderWidth: 1 },
  handleRow: { flexDirection: "row", alignItems: "center", gap: space.xs, marginTop: space.md },
  handle: { fontSize: 22, fontWeight: "800", color: colors.ink },
  email: { fontSize: 14, color: colors.muted, marginTop: 2 },
  bio: { fontSize: 14, color: colors.ink, marginTop: space.sm, textAlign: "center", lineHeight: 20, paddingHorizontal: space.md },
  stats: { flexDirection: "row", gap: space.xl, marginTop: space.lg, marginBottom: space.lg },
  stat: { alignItems: "center" },
  statNum: { fontSize: 20, fontWeight: "800", color: colors.ink },
  statLabel: { fontSize: 12, color: colors.muted, fontWeight: "600", marginTop: 2 },
  traits: { alignSelf: "stretch", alignItems: "center", marginBottom: space.xl },
  traitBubbles: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: space.xs },
  traitBubble: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: space.md, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.accent },
  traitBubbleOn: { backgroundColor: colors.accentPress },
  traitEmoji: { fontSize: 13 },
  traitName: { fontSize: 13, fontWeight: "800", color: colors.ink },
  traitDetail: { fontSize: 13, color: colors.muted, textAlign: "center", marginTop: space.sm, lineHeight: 19, paddingHorizontal: space.md },
  actionRow: { alignSelf: "stretch", flexDirection: "row", alignItems: "center", gap: space.md, backgroundColor: colors.surface, borderColor: colors.hair, borderWidth: 1, borderRadius: radius.md, padding: space.md, marginBottom: space.lg },
  actionText: { flex: 1 },
  actionTitle: { fontSize: 15, fontWeight: "800", color: colors.ink },
  actionHelp: { fontSize: 13, color: colors.muted, marginTop: 2, lineHeight: 18 },
  viewToggle: { alignSelf: "stretch", flexDirection: "row", gap: space.xs, backgroundColor: colors.canvas, borderRadius: radius.pill, padding: 4, marginBottom: space.md },
  viewBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.xs, paddingVertical: space.sm, borderRadius: radius.pill },
  viewBtnOn: { backgroundColor: colors.accent },
  viewTxt: { fontSize: 14, fontWeight: "800", color: colors.muted },
  viewTxtOn: { color: colors.onAccent },
  savedTabs: { alignSelf: "stretch", flexDirection: "row", flexWrap: "wrap", gap: space.xs, justifyContent: "center", marginBottom: space.md },
  savedTab: { paddingHorizontal: space.md, paddingVertical: 7, borderRadius: radius.pill, borderColor: colors.hair, borderWidth: 1, backgroundColor: colors.surface },
  savedTabTxt: { fontSize: 13, fontWeight: "700", color: colors.muted },
  savedTabTxtOn: { color: "#fff" },
  empty: { fontSize: 14, color: colors.muted, textAlign: "center", lineHeight: 21, paddingHorizontal: space.md },
  review: { alignSelf: "stretch", backgroundColor: colors.surface, borderColor: colors.hair, borderWidth: 1, borderRadius: radius.md, padding: space.md, marginBottom: space.sm, gap: 4 },
  reviewHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm },
  reviewPlace: { flex: 1, fontSize: 15, fontWeight: "700", color: colors.ink },
  reviewRating: { color: colors.accentPress, fontWeight: "800" },
  reviewState: { alignSelf: "flex-start", color: "#fff", backgroundColor: colors.canvas, borderColor: colors.hair, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 3, fontSize: 12, fontWeight: "800", overflow: "hidden" },
  likedChip: { backgroundColor: colors.been, borderColor: colors.been },
  lovedChip: { backgroundColor: colors.loved, borderColor: colors.loved },
  dislikedChip: { backgroundColor: colors.avoid, borderColor: colors.avoid },
  reviewBody: { fontSize: 14, color: colors.ink, lineHeight: 20 },
});
