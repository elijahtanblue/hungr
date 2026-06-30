import { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { parseImportText } from "../src/domain/importList";
import { resolveImportRows, addPlacesToWantToGo, type ImportResult } from "../src/api/importPlaces";
import type { Place } from "../src/domain/types";
import { formatRating } from "../src/lib/formatRating";
import { colors, radius, space } from "../src/theme";

// One pasted row after resolution: its candidates, which one is selected, and whether the user
// dropped it. selected indexes into candidates.
type ReviewItem = { name: string; candidates: Place[]; selected: number; removed: boolean };

async function currentBias(): Promise<{ lat: number; lng: number }> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status === "granted") {
      const loc = await Location.getCurrentPositionAsync({});
      return { lat: loc.coords.latitude, lng: loc.coords.longitude };
    }
  } catch { /* fall through */ }
  return { lat: -33.87, lng: 151.21 };
}

export default function Import() {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<"input" | "review" | "done">("input");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function findMatches() {
    const rows = parseImportText(text);
    if (rows.length === 0) return;
    setBusy(true);
    setProgress({ done: 0, total: rows.length });
    const bias = await currentBias();
    const resolved = await resolveImportRows(rows, bias, (done, total) => setProgress({ done, total }));
    setItems(resolved.map((r) => ({ name: r.name, candidates: r.candidates, selected: 0, removed: false })));
    setBusy(false);
    setPhase("review");
  }

  function cycle(index: number) {
    setItems((prev) => prev.map((it, i) =>
      i === index && it.candidates.length > 1
        ? { ...it, selected: (it.selected + 1) % it.candidates.length }
        : it,
    ));
  }
  function toggleRemove(index: number) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, removed: !it.removed } : it)));
  }

  const keepers = items.filter((it) => !it.removed && it.candidates.length > 0);

  async function addAll() {
    setBusy(true);
    const picks = keepers.map((it) => it.candidates[it.selected]);
    const res = await addPlacesToWantToGo(picks);
    setBusy(false);
    setResult(res);
    setPhase("done");
  }

  return (
    <View style={s.wrap}>
      <View style={[s.header, { paddingTop: insets.top + space.sm }]}>
        <Pressable onPress={() => router.back()} style={s.back} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </Pressable>
        <Text style={s.title}>Import a list</Text>
      </View>

      <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + space.xxl }]} keyboardShouldPersistTaps="handled">
        {phase === "input" && (
          <>
            <Text style={s.help}>
              Paste places from your Google Maps saved list (open the Takeout CSV), a spreadsheet, or
              your notes: one place per line, or a "Name, Address" per line. We will find each one so
              you can confirm before adding them to Want to go.
            </Text>
            <TextInput
              style={s.input}
              placeholder={"Mr Wong, Bridge St\nGumshara Ramen\n..."}
              placeholderTextColor={colors.muted}
              value={text}
              onChangeText={setText}
              multiline
              autoCapitalize="none"
              editable={!busy}
            />
            <Pressable
              style={[s.cta, (busy || !text.trim()) && s.ctaDisabled]}
              onPress={findMatches}
              disabled={busy || !text.trim()}
              accessibilityRole="button"
            >
              {busy ? (
                <>
                  <ActivityIndicator color={colors.onAccent} />
                  <Text style={s.ctaTxt}>Finding {progress.done}/{progress.total}</Text>
                </>
              ) : (
                <Text style={s.ctaTxt}>Find matches</Text>
              )}
            </Pressable>
          </>
        )}

        {phase === "review" && (
          <>
            <Text style={s.help}>
              Confirm each match. Tap a card to try another result, or remove the ones you do not want.
            </Text>
            {items.map((it, i) => {
              const match = it.candidates[it.selected];
              return (
                <View key={`${it.name}-${i}`} style={[s.card, it.removed && s.cardRemoved]}>
                  <View style={s.cardTop}>
                    <Text style={s.fromTxt} numberOfLines={1}>From: {it.name}</Text>
                    <Pressable onPress={() => toggleRemove(i)} hitSlop={8} accessibilityRole="button" accessibilityLabel={it.removed ? "Keep this row" : "Remove this row"}>
                      <Ionicons name={it.removed ? "add-circle-outline" : "trash-outline"} size={18} color={it.removed ? colors.been : colors.avoid} />
                    </Pressable>
                  </View>
                  {match ? (
                    <Pressable onPress={() => cycle(i)} disabled={it.removed || it.candidates.length < 2} accessibilityRole="button">
                      <Text style={[s.matchName, it.removed && s.struck]} numberOfLines={1}>{match.name}</Text>
                      <Text style={s.matchMeta} numberOfLines={1}>
                        {match.cuisines.slice(0, 3).join(" · ")}{match.rating !== undefined ? `${match.cuisines.length ? "  ·  " : ""}★ ${formatRating(match.rating)}` : ""}
                      </Text>
                      {!it.removed && it.candidates.length > 1 && (
                        <Text style={s.tryAnother}>Not this? Tap to try another ({it.selected + 1}/{it.candidates.length})</Text>
                      )}
                    </Pressable>
                  ) : (
                    <Text style={s.noMatch}>No match found. Add a suburb to the line and import again.</Text>
                  )}
                </View>
              );
            })}
            <Pressable
              style={[s.cta, (busy || keepers.length === 0) && s.ctaDisabled]}
              onPress={addAll}
              disabled={busy || keepers.length === 0}
              accessibilityRole="button"
            >
              {busy ? <ActivityIndicator color={colors.onAccent} /> : <Text style={s.ctaTxt}>Add {keepers.length} to Want to go</Text>}
            </Pressable>
          </>
        )}

        {phase === "done" && result && (
          <View style={s.result}>
            <Text style={s.resultTitle}>Added {result.added.length} to Want to go</Text>
            {result.added.map((n) => (
              <View key={`a-${n}`} style={s.line}>
                <Ionicons name="bookmark" size={14} color={colors.accentPress} />
                <Text style={s.lineTxt} numberOfLines={1}>{n}</Text>
              </View>
            ))}
            {result.missed.length > 0 && (
              <>
                <Text style={[s.resultTitle, s.missedTitle]}>Could not save {result.missed.length}</Text>
                {result.missed.map((n) => (
                  <View key={`m-${n}`} style={s.line}>
                    <Ionicons name="help-circle-outline" size={14} color={colors.muted} />
                    <Text style={[s.lineTxt, s.missedTxt]} numberOfLines={1}>{n}</Text>
                  </View>
                ))}
              </>
            )}
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
    minHeight: 160, borderColor: colors.hair, borderWidth: 1, borderRadius: radius.md, padding: space.md,
    color: colors.ink, textAlignVertical: "top", backgroundColor: colors.surface, fontSize: 15, lineHeight: 22,
  },
  cta: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm,
    backgroundColor: colors.accent, borderRadius: radius.md, minHeight: 50, marginTop: space.sm,
  },
  ctaDisabled: { backgroundColor: colors.hair },
  ctaTxt: { color: colors.onAccent, fontWeight: "800", fontSize: 15 },
  card: { borderColor: colors.hair, borderWidth: 1, borderRadius: radius.md, padding: space.md, backgroundColor: colors.surface, gap: 4 },
  cardRemoved: { opacity: 0.55 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm },
  fromTxt: { flex: 1, fontSize: 12, color: colors.muted, fontWeight: "600" },
  matchName: { fontSize: 16, fontWeight: "700", color: colors.ink },
  struck: { textDecorationLine: "line-through" },
  matchMeta: { fontSize: 13, color: colors.muted, marginTop: 1 },
  tryAnother: { fontSize: 12, color: colors.accentPress, fontWeight: "700", marginTop: 4 },
  noMatch: { fontSize: 13, color: colors.avoid },
  result: { gap: space.xs },
  resultTitle: { fontSize: 15, fontWeight: "800", color: colors.ink, marginTop: space.sm },
  missedTitle: { color: colors.muted },
  line: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: 3 },
  lineTxt: { flex: 1, fontSize: 14, color: colors.ink },
  missedTxt: { color: colors.muted },
});
