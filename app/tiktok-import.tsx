import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";
import {
  resolveTikTokLink,
  saveTikTokCandidate,
  type TikTokImportResult,
  type TikTokPlaceCandidate,
} from "../src/api/tiktokImport";
import { formatRating } from "../src/lib/formatRating";
import { colors, radius, space } from "../src/theme";

async function currentBias(): Promise<{ lat: number; lng: number }> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status === "granted") {
      const loc = await Location.getCurrentPositionAsync({});
      return { lat: loc.coords.latitude, lng: loc.coords.longitude };
    }
  } catch {
    // Fall back to the app's default Sydney bias.
  }
  return { lat: -33.87, lng: 151.21 };
}

export default function TikTokImport() {
  const insets = useSafeAreaInsets();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<"input" | "review" | "empty" | "done">("input");
  const [result, setResult] = useState<TikTokImportResult | null>(null);
  const [saved, setSaved] = useState<TikTokPlaceCandidate | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function findPlace() {
    const link = url.trim();
    if (!link) return;
    setBusy(true);
    setError(null);
    try {
      const bias = await currentBias();
      const next = await resolveTikTokLink(link, bias);
      setResult(next);
      setPhase(next.candidates.length > 0 ? "review" : "empty");
    } catch {
      setError("We could not read that TikTok link.");
    } finally {
      setBusy(false);
    }
  }

  async function confirm(candidate: TikTokPlaceCandidate) {
    if (!result) return;
    setBusy(true);
    setError(null);
    try {
      const ok = await saveTikTokCandidate(result.source, candidate, result.dishTags);
      if (!ok) {
        setError("We could not save this place.");
        return;
      }
      setSaved(candidate);
      setPhase("done");
    } catch {
      setError("We could not save this place.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={s.wrap}>
      <View style={[s.header, { paddingTop: insets.top + space.sm }]}>
        <Pressable onPress={() => router.back()} style={s.back} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </Pressable>
        <Text style={s.title}>Save from TikTok</Text>
      </View>

      <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + space.xxl }]} keyboardShouldPersistTaps="handled">
        {phase === "input" && (
          <>
            <Text style={s.help}>
              Paste a TikTok food link. hungr will look for likely places, then you choose the right one before anything is saved.
            </Text>
            <TextInput
              style={s.input}
              placeholder="Paste TikTok link"
              placeholderTextColor={colors.muted}
              value={url}
              onChangeText={(text) => { setUrl(text); setError(null); }}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!busy}
            />
            {error && <Text style={s.error}>{error}</Text>}
            <Pressable
              style={[s.cta, (busy || !url.trim()) && s.ctaDisabled]}
              onPress={findPlace}
              disabled={busy || !url.trim()}
              accessibilityRole="button"
            >
              {busy ? <ActivityIndicator color={colors.onAccent} /> : <Text style={s.ctaTxt}>Find the place</Text>}
            </Pressable>
          </>
        )}

        {phase === "review" && result && (
          <>
            <Text style={s.help}>Choose the correct place. We will only save the one you confirm.</Text>
            {result.source.creator && <Text style={s.source}>From {result.source.creator}</Text>}
            {result.source.title ? <Text style={s.caption}>{result.source.title}</Text> : null}
            {result.candidates.map((candidate) => (
              <View key={candidate.placeId} style={s.card}>
                <View style={s.cardTop}>
                  <Text style={s.placeName}>{candidate.name}</Text>
                  {candidate.recommended && <Text style={s.recommended}>Recommended match</Text>}
                </View>
                {candidate.address ? <Text style={s.meta}>{candidate.address}</Text> : null}
                <Text style={s.meta}>
                  {candidate.cuisines.slice(0, 3).join(" · ")}{candidate.rating !== undefined ? `${candidate.cuisines.length ? "  ·  " : ""}★ ${formatRating(candidate.rating)}` : ""}
                </Text>
                <Text style={s.evidence}>{candidate.evidence}</Text>
                <Pressable
                  style={[s.secondaryCta, busy && s.secondaryDisabled]}
                  onPress={() => confirm(candidate)}
                  disabled={busy}
                  accessibilityRole="button"
                >
                  <Text style={s.secondaryTxt}>Save this place</Text>
                </Pressable>
              </View>
            ))}
            {error && <Text style={s.error}>{error}</Text>}
          </>
        )}

        {phase === "empty" && (
          <View style={s.card}>
            <Ionicons name="search" size={22} color={colors.accentPress} />
            <Text style={s.emptyTitle}>We could not confidently find the place.</Text>
            <Text style={s.help}>Try searching the restaurant name or suburb manually on the map.</Text>
            <Pressable style={s.secondaryCta} onPress={() => router.back()} accessibilityRole="button">
              <Text style={s.secondaryTxt}>Back to map</Text>
            </Pressable>
          </View>
        )}

        {phase === "done" && saved && (
          <View style={s.card}>
            <Ionicons name="bookmark" size={22} color={colors.accentPress} />
            <Text style={s.emptyTitle}>Saved to Want to go</Text>
            <Text style={s.placeName}>{saved.name}</Text>
            {saved.address ? <Text style={s.meta}>{saved.address}</Text> : null}
            <Pressable style={s.cta} onPress={() => router.back()} accessibilityRole="button">
              <Text style={s.ctaTxt}>Done</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.canvas },
  header: {
    flexDirection: "row", alignItems: "center", gap: space.xs, paddingHorizontal: space.md,
    paddingBottom: space.sm, borderBottomColor: colors.hair, borderBottomWidth: 1, backgroundColor: colors.surface,
  },
  back: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 18, fontWeight: "800", color: colors.ink },
  content: { padding: space.xl, gap: space.md },
  help: { fontSize: 14, color: colors.muted, lineHeight: 21 },
  input: {
    borderColor: colors.hair, borderWidth: 1, borderRadius: radius.md, padding: space.md,
    color: colors.ink, backgroundColor: colors.surface, minHeight: 50, fontSize: 15,
  },
  cta: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm,
    backgroundColor: colors.accent, borderRadius: radius.md, minHeight: 50, marginTop: space.sm,
  },
  ctaDisabled: { backgroundColor: colors.hair },
  ctaTxt: { color: colors.onAccent, fontWeight: "800", fontSize: 15 },
  card: { borderColor: colors.hair, borderWidth: 1, borderRadius: radius.md, padding: space.md, backgroundColor: colors.surface, gap: space.sm },
  cardTop: { gap: space.xs },
  source: { color: colors.accentPress, fontWeight: "800", fontSize: 13 },
  caption: { color: colors.ink, fontSize: 15, lineHeight: 21 },
  placeName: { fontSize: 17, fontWeight: "800", color: colors.ink },
  recommended: { alignSelf: "flex-start", color: colors.onAccent, backgroundColor: colors.accent, borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 4, fontSize: 12, fontWeight: "800" },
  meta: { color: colors.muted, fontSize: 13 },
  evidence: { color: colors.ink, fontSize: 13, lineHeight: 19 },
  secondaryCta: { borderColor: colors.accent, borderWidth: 1, borderRadius: radius.md, minHeight: 44, alignItems: "center", justifyContent: "center", marginTop: space.xs },
  secondaryDisabled: { opacity: 0.55 },
  secondaryTxt: { color: colors.accentPress, fontWeight: "800" },
  emptyTitle: { color: colors.ink, fontSize: 18, fontWeight: "800" },
  error: { color: colors.avoid, fontSize: 13, fontWeight: "700" },
});
